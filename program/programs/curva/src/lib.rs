//! Curva — parimutuel World Cup prediction pools with trustless settlement.
//! Named for the terrace where the most devoted fans stand, and for the live
//! probability curve the product is built around. The only referee is the proof.
//!
//! Settlement never trusts an admin, a keeper, or this program's authors:
//! `settle` performs a CPI into TxLINE's TxOracle `validate_stat`, which checks a
//! Merkle proof of the final goal counts against the daily scores root that
//! TxODDS anchors on Solana. Funds only move when the chain itself has verified
//! the result.
//!
//! Anti-manipulation gates enforced on-chain in `settle`:
//!   1. The proven stats must come from the match FINALISATION record
//!      (`ScoreStat.period == FINAL_PERIOD`), so a half-time snapshot can never
//!      settle a market that later changed.
//!   2. The proof's own `max_timestamp` (hashed into the Merkle commitment,
//!      unforgeable) must be at least `MIN_MATCH_DURATION_MS` past kickoff.
//!   3. The stat keys must be exactly participant-1 and participant-2 total
//!      goals, in that order, so `Subtract` has one deterministic meaning.
//!
//! If a market can never be settled (abandoned match, coverage cancelled),
//! every position becomes refundable after `REFUND_DELAY_MS`.

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_program!(txoracle);
use txoracle::cpi::accounts::ValidateStat;
use txoracle::program::Txoracle;
use txoracle::types::{
    BinaryExpression, Comparison, ProofNode, ScoresBatchSummary, StatTerm, TraderPredicate,
};

declare_id!("3L9Yb4AicTqnVCAV12R1enNW5dPZHHT26QtWNiQNP4xp");

/// Stat period stamped on `game_finalised` records by the TxLINE feed.
pub const FINAL_PERIOD: i32 = 100;
/// Total-game goal stat keys for participant 1 and participant 2.
pub const STAT_KEY_P1_GOALS: u32 = 1;
pub const STAT_KEY_P2_GOALS: u32 = 2;
/// Shortest possible completed regulation match (ms): 2x45' + halftime margin.
pub const MIN_MATCH_DURATION_MS: i64 = 105 * 60 * 1000;
/// Unsettleable markets unlock refunds this long after kickoff (ms).
pub const REFUND_DELAY_MS: i64 = 72 * 60 * 60 * 1000;
/// Minimum stake: 0.001 SOL keeps dust positions out.
pub const MIN_STAKE_LAMPORTS: u64 = 1_000_000;

pub const SIDE_P1: u8 = 0;
pub const SIDE_DRAW: u8 = 1;
pub const SIDE_P2: u8 = 2;

#[program]
pub mod curva {
    use super::*;

    /// Open a market for a fixture. Permissionless: anyone can create the
    /// market for a fixture once; all parameters are deterministic.
    pub fn create_market(ctx: Context<CreateMarket>, fixture_id: i64, kickoff_ts_ms: i64) -> Result<()> {
        require!(fixture_id > 0, MarketError::BadFixture);
        require!(kickoff_ts_ms > 0, MarketError::BadFixture);

        let market = &mut ctx.accounts.market;
        market.fixture_id = fixture_id;
        market.kickoff_ts_ms = kickoff_ts_ms;
        market.pools = [0; 3];
        market.state = MarketState::Open;
        market.outcome = 0;
        market.goals = [0, 0];
        market.settled_ts_ms = 0;
        market.roots_account = Pubkey::default();
        market.bump = ctx.bumps.market;
        market.vault_bump = ctx.bumps.vault;
        Ok(())
    }

    /// Stake lamports on a side (0 = participant 1 wins, 1 = draw,
    /// 2 = participant 2 wins). Staking closes at kickoff.
    pub fn stake(ctx: Context<Stake>, side: u8, amount: u64) -> Result<()> {
        require!(side <= SIDE_P2, MarketError::BadSide);
        require!(amount >= MIN_STAKE_LAMPORTS, MarketError::StakeTooSmall);

        let market = &mut ctx.accounts.market;
        require!(market.state == MarketState::Open, MarketError::MarketClosed);
        require!(now_ms()? < market.kickoff_ts_ms, MarketError::MarketClosed);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;

        let position = &mut ctx.accounts.position;
        if position.amount == 0 {
            position.owner = ctx.accounts.owner.key();
            position.market = market.key();
            position.side = side;
            position.claimed = false;
        }
        require!(position.side == side, MarketError::BadSide);
        position.amount = position.amount.checked_add(amount).ok_or(MarketError::MathOverflow)?;
        market.pools[side as usize] = market.pools[side as usize]
            .checked_add(amount)
            .ok_or(MarketError::MathOverflow)?;
        Ok(())
    }

    /// Settle the market with a TxLINE Merkle proof of the final goal counts.
    /// Permissionless: any caller with a valid finalisation proof can settle,
    /// and an invalid or non-final proof always fails. The claimed outcome is
    /// checked by TxOracle itself: P1 goals minus P2 goals compared to zero.
    #[allow(clippy::too_many_arguments)]
    pub fn settle(
        ctx: Context<Settle>,
        claimed_outcome: u8,
        target_ts_ms: i64,
        fixture_summary: ScoresBatchSummary,
        fixture_proof: Vec<ProofNode>,
        main_tree_proof: Vec<ProofNode>,
        stat_p1: StatTerm,
        stat_p2: StatTerm,
    ) -> Result<()> {
        require!(claimed_outcome <= SIDE_P2, MarketError::BadSide);
        let market_key = ctx.accounts.market.key();
        {
            let market = &ctx.accounts.market;
            require!(market.state == MarketState::Open, MarketError::AlreadySettled);
            require!(fixture_summary.fixture_id == market.fixture_id, MarketError::WrongFixture);

            // Gate 1: only finalisation-record stats can settle.
            require!(stat_p1.stat_to_prove.period == FINAL_PERIOD, MarketError::NotFinalRecord);
            require!(stat_p2.stat_to_prove.period == FINAL_PERIOD, MarketError::NotFinalRecord);

            // Gate 2: the proven update window must extend past a completable match.
            require!(
                fixture_summary.update_stats.max_timestamp
                    >= market.kickoff_ts_ms + MIN_MATCH_DURATION_MS,
                MarketError::ProofTooEarly
            );

            // Gate 3: fixed stat identities so Subtract is unambiguous.
            require!(stat_p1.stat_to_prove.key == STAT_KEY_P1_GOALS, MarketError::WrongStatKey);
            require!(stat_p2.stat_to_prove.key == STAT_KEY_P2_GOALS, MarketError::WrongStatKey);
        }

        // Outcome predicate: (P1 goals - P2 goals) vs 0.
        let comparison = match claimed_outcome {
            SIDE_P1 => Comparison::GreaterThan,
            SIDE_DRAW => Comparison::EqualTo,
            _ => Comparison::LessThan,
        };
        let goals = [stat_p1.stat_to_prove.value, stat_p2.stat_to_prove.value];

        let cpi_ctx = CpiContext::new(
            ctx.accounts.txoracle_program.to_account_info(),
            ValidateStat {
                daily_scores_merkle_roots: ctx.accounts.daily_scores_merkle_roots.to_account_info(),
            },
        );
        let validated = txoracle::cpi::validate_stat(
            cpi_ctx,
            target_ts_ms,
            fixture_summary,
            fixture_proof,
            main_tree_proof,
            TraderPredicate { threshold: 0, comparison },
            stat_p1,
            Some(stat_p2),
            Some(BinaryExpression::Subtract),
        )?
        .get();
        require!(validated, MarketError::ProofRejected);

        let market = &mut ctx.accounts.market;
        market.state = MarketState::Settled;
        market.outcome = claimed_outcome;
        market.goals = goals;
        market.settled_ts_ms = now_ms()?;
        market.roots_account = ctx.accounts.daily_scores_merkle_roots.key();

        emit!(MarketSettled {
            market: market_key,
            fixture_id: market.fixture_id,
            outcome: claimed_outcome,
            goals,
            roots_account: market.roots_account,
        });
        Ok(())
    }

    /// Pay out a position. Settled market: winners split the whole pot
    /// pro-rata (or are refunded if the winning pool is empty). Unsettled
    /// market long past kickoff: everyone is refunded their stake.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let market = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;
        require!(!position.claimed, MarketError::AlreadyClaimed);

        let payout: u64 = match market.state {
            MarketState::Settled => {
                let winning_pool = market.pools[market.outcome as usize];
                if winning_pool == 0 {
                    // Nobody backed the result: every stake is refunded.
                    position.amount
                } else if position.side == market.outcome {
                    let total: u128 = market.pools.iter().map(|p| *p as u128).sum();
                    ((position.amount as u128)
                        .checked_mul(total)
                        .ok_or(MarketError::MathOverflow)?
                        / winning_pool as u128) as u64
                } else {
                    0
                }
            }
            MarketState::Open => {
                // Abandoned / unsettleable market: refunds unlock after the delay.
                require!(
                    now_ms()? > market.kickoff_ts_ms + REFUND_DELAY_MS,
                    MarketError::NotRefundableYet
                );
                position.amount
            }
        };
        require!(payout > 0, MarketError::NothingToClaim);
        position.claimed = true;

        let market_key = market.key();
        let seeds: &[&[u8]] = &[b"vault", market_key.as_ref(), &[market.vault_bump]];
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.owner.to_account_info(),
                },
                &[seeds],
            ),
            payout,
        )?;
        Ok(())
    }
}

fn now_ms() -> Result<i64> {
    Ok(Clock::get()?.unix_timestamp.checked_mul(1000).ok_or(MarketError::MathOverflow)?)
}

#[derive(Accounts)]
#[instruction(fixture_id: i64)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Market::INIT_SPACE,
        seeds = [b"market", fixture_id.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,
    /// CHECK: program-derived lamport vault; only ever moved via signed CPI here.
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(side: u8)]
pub struct Stake<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    /// CHECK: program-derived lamport vault for this market.
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump = market.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + Position::INIT_SPACE,
        seeds = [b"position", market.key().as_ref(), owner.key().as_ref(), &[side]],
        bump
    )]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    /// CHECK: TxOracle's daily scores Merkle-roots PDA; TxOracle validates it
    /// against its own program id and the proof's epoch day during the CPI.
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,
    pub txoracle_program: Program<'info, Txoracle>,
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    pub market: Account<'info, Market>,
    /// CHECK: program-derived lamport vault for this market.
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump = market.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = position.market == market.key() @ MarketError::WrongFixture,
        constraint = position.owner == owner.key() @ MarketError::NotYourPosition,
    )]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub fixture_id: i64,
    pub kickoff_ts_ms: i64,
    /// Lamports staked per side: [participant 1, draw, participant 2].
    pub pools: [u64; 3],
    pub state: MarketState,
    pub outcome: u8,
    /// Final [P1, P2] goals as proven on-chain at settlement.
    pub goals: [i32; 2],
    pub settled_ts_ms: i64,
    /// The TxOracle roots account the settlement proof was verified against.
    pub roots_account: Pubkey,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub side: u8,
    pub amount: u64,
    pub claimed: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MarketState {
    Open,
    Settled,
}

#[event]
pub struct MarketSettled {
    pub market: Pubkey,
    pub fixture_id: i64,
    pub outcome: u8,
    pub goals: [i32; 2],
    pub roots_account: Pubkey,
}

#[error_code]
pub enum MarketError {
    #[msg("Invalid fixture parameters")]
    BadFixture,
    #[msg("Side must be 0 (P1), 1 (draw) or 2 (P2)")]
    BadSide,
    #[msg("Stake below minimum")]
    StakeTooSmall,
    #[msg("Market is closed for staking")]
    MarketClosed,
    #[msg("Market already settled")]
    AlreadySettled,
    #[msg("Proof is for a different fixture")]
    WrongFixture,
    #[msg("Only finalisation-record stats (period 100) can settle a market")]
    NotFinalRecord,
    #[msg("Proof window ends before the match could have finished")]
    ProofTooEarly,
    #[msg("Stats must be P1 and P2 total goals (keys 1 and 2)")]
    WrongStatKey,
    #[msg("TxOracle rejected the proof for the claimed outcome")]
    ProofRejected,
    #[msg("Position already claimed")]
    AlreadyClaimed,
    #[msg("Market is not refundable yet")]
    NotRefundableYet,
    #[msg("Nothing to claim for this position")]
    NothingToClaim,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Position belongs to a different owner")]
    NotYourPosition,
}
