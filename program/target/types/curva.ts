/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/curva.json`.
 */
export type Curva = {
  "address": "3L9Yb4AicTqnVCAV12R1enNW5dPZHHT26QtWNiQNP4xp",
  "metadata": {
    "name": "curva",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Curva: parimutuel World Cup pools settled trustlessly via CPI into TxLINE's TxOracle validate_stat"
  },
  "instructions": [
    {
      "name": "claim",
      "docs": [
        "Pay out a position. Settled market: winners split the whole pot",
        "pro-rata (or are refunded if the winning pool is empty). Unsettled",
        "market long past kickoff: everyone is refunded their stake."
      ],
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "market"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createMarket",
      "docs": [
        "Open a market for a fixture. Permissionless: anyone can create the",
        "market for a fixture once; all parameters are deterministic."
      ],
      "discriminator": [
        103,
        226,
        97,
        235,
        200,
        188,
        251,
        254
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "fixtureId"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "fixtureId",
          "type": "i64"
        },
        {
          "name": "kickoffTsMs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "settle",
      "docs": [
        "Settle the market with a TxLINE Merkle proof of the final goal counts.",
        "Permissionless: any caller with a valid finalisation proof can settle,",
        "and an invalid or non-final proof always fails. The claimed outcome is",
        "checked by TxOracle itself: P1 goals minus P2 goals compared to zero."
      ],
      "discriminator": [
        175,
        42,
        185,
        87,
        144,
        131,
        102,
        212
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "dailyScoresMerkleRoots",
          "docs": [
            "against its own program id and the proof's epoch day during the CPI."
          ]
        },
        {
          "name": "txoracleProgram",
          "address": "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"
        },
        {
          "name": "payer",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "claimedOutcome",
          "type": "u8"
        },
        {
          "name": "targetTsMs",
          "type": "i64"
        },
        {
          "name": "fixtureSummary",
          "type": {
            "defined": {
              "name": "scoresBatchSummary"
            }
          }
        },
        {
          "name": "fixtureProof",
          "type": {
            "vec": {
              "defined": {
                "name": "proofNode"
              }
            }
          }
        },
        {
          "name": "mainTreeProof",
          "type": {
            "vec": {
              "defined": {
                "name": "proofNode"
              }
            }
          }
        },
        {
          "name": "statP1",
          "type": {
            "defined": {
              "name": "statTerm"
            }
          }
        },
        {
          "name": "statP2",
          "type": {
            "defined": {
              "name": "statTerm"
            }
          }
        }
      ]
    },
    {
      "name": "stake",
      "docs": [
        "Stake lamports on a side (0 = participant 1 wins, 1 = draw,",
        "2 = participant 2 wins). Staking closes at kickoff."
      ],
      "discriminator": [
        206,
        176,
        202,
        18,
        200,
        209,
        179,
        108
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "side",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    },
    {
      "name": "position",
      "discriminator": [
        170,
        188,
        143,
        228,
        122,
        64,
        247,
        208
      ]
    }
  ],
  "events": [
    {
      "name": "marketSettled",
      "discriminator": [
        237,
        212,
        22,
        175,
        201,
        117,
        215,
        99
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "eventNotActive"
    },
    {
      "code": 6001,
      "name": "pricesMismatch"
    },
    {
      "code": 6002,
      "name": "invalidOddsUpdate"
    },
    {
      "code": 6003,
      "name": "invalidSubTreeProof"
    },
    {
      "code": 6004,
      "name": "invalidMainTreeProof"
    },
    {
      "code": 6005,
      "name": "timeSlotMismatch"
    },
    {
      "code": 6006,
      "name": "invalidTime"
    },
    {
      "code": 6007,
      "name": "rootNotAvailable"
    },
    {
      "code": 6008,
      "name": "accountDiscriminatorMismatch"
    },
    {
      "code": 6009,
      "name": "invalidPda"
    },
    {
      "code": 6010,
      "name": "timestampMismatch"
    },
    {
      "code": 6011,
      "name": "sliceError"
    },
    {
      "code": 6012,
      "name": "invalidOwner"
    },
    {
      "code": 6013,
      "name": "invalidTimeSlot"
    },
    {
      "code": 6014,
      "name": "stakeStillLocked"
    },
    {
      "code": 6015,
      "name": "invalidRecipient"
    },
    {
      "code": 6016,
      "name": "activeSubscription"
    },
    {
      "code": 6017,
      "name": "unauthorized"
    },
    {
      "code": 6018,
      "name": "invalidAccountOwner"
    },
    {
      "code": 6019,
      "name": "invalidMintAuthority"
    },
    {
      "code": 6020,
      "name": "invalidMint"
    },
    {
      "code": 6021,
      "name": "predicateFailed"
    },
    {
      "code": 6022,
      "name": "invalidFixtureSubTreeProof"
    },
    {
      "code": 6023,
      "name": "invalidStatProof"
    },
    {
      "code": 6024,
      "name": "invalidStatCombination"
    },
    {
      "code": 6025,
      "name": "missingSecondStat"
    },
    {
      "code": 6026,
      "name": "unexpectedSecondStat"
    },
    {
      "code": 6027,
      "name": "overflow"
    },
    {
      "code": 6028,
      "name": "tradeNotActive"
    },
    {
      "code": 6029,
      "name": "invalidTrader"
    },
    {
      "code": 6030,
      "name": "winnerMismatch"
    },
    {
      "code": 6031,
      "name": "tradeTermsMismatch"
    },
    {
      "code": 6032,
      "name": "unauthorizedSettler"
    },
    {
      "code": 6033,
      "name": "fundsBelowMinimumDeposit"
    },
    {
      "code": 6034,
      "name": "insufficientUserBalance"
    },
    {
      "code": 6035,
      "name": "zeroAmount"
    },
    {
      "code": 6036,
      "name": "vaultNotEmpty"
    },
    {
      "code": 6037,
      "name": "insufficientVaultBalance"
    },
    {
      "code": 6038,
      "name": "calculationError"
    },
    {
      "code": 6039,
      "name": "invalidSubscriptionTs"
    },
    {
      "code": 6040,
      "name": "cannotShortenSubscription"
    },
    {
      "code": 6041,
      "name": "invalidWeeks"
    },
    {
      "code": 6042,
      "name": "invalidTimeAlignment"
    },
    {
      "code": 6043,
      "name": "invalidEpochDayAlignment"
    },
    {
      "code": 6044,
      "name": "accountDataTooSmall"
    },
    {
      "code": 6045,
      "name": "insufficientLiquidity"
    },
    {
      "code": 6046,
      "name": "invalidAmount"
    },
    {
      "code": 6047,
      "name": "invalidExpiration"
    },
    {
      "code": 6048,
      "name": "fixtureMismatch"
    },
    {
      "code": 6049,
      "name": "periodMismatch"
    },
    {
      "code": 6050,
      "name": "intentNotActive"
    },
    {
      "code": 6051,
      "name": "orderNotYetExpired"
    },
    {
      "code": 6052,
      "name": "termsMismatch"
    },
    {
      "code": 6053,
      "name": "statKeyMismatch"
    },
    {
      "code": 6054,
      "name": "invalidVault"
    },
    {
      "code": 6055,
      "name": "equivocationAttempt"
    },
    {
      "code": 6056,
      "name": "numericOverflow"
    },
    {
      "code": 6057,
      "name": "invalidAccountData"
    },
    {
      "code": 6058,
      "name": "rateLimitExceeded"
    },
    {
      "code": 6059,
      "name": "invalidServiceLevelId"
    },
    {
      "code": 6060,
      "name": "initialRowsLimitExceeded"
    },
    {
      "code": 6061,
      "name": "missingStat"
    },
    {
      "code": 6062,
      "name": "proofTooLarge"
    },
    {
      "code": 6063,
      "name": "tradeTooSmall"
    },
    {
      "code": 6064,
      "name": "maxRowsLimitExceeded"
    },
    {
      "code": 6065,
      "name": "unauthorizedAdmin"
    },
    {
      "code": 6066,
      "name": "invalidAccount"
    },
    {
      "code": 6067,
      "name": "missingSummary"
    },
    {
      "code": 6068,
      "name": "missingProof"
    },
    {
      "code": 6069,
      "name": "tooManyStats"
    },
    {
      "code": 6070,
      "name": "duplicateStatCoverage"
    },
    {
      "code": 6071,
      "name": "incompleteStatCoverage"
    },
    {
      "code": 6072,
      "name": "missingDistancePredicate"
    },
    {
      "code": 6073,
      "name": "indexOutOfBounds"
    },
    {
      "code": 6074,
      "name": "statNotZero"
    },
    {
      "code": 6075,
      "name": "lengthMismatch"
    },
    {
      "code": 6076,
      "name": "invalidMultiproof"
    },
    {
      "code": 6077,
      "name": "missingProofNode"
    },
    {
      "code": 6078,
      "name": "invalidProofPath"
    }
  ],
  "types": [
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "kickoffTsMs",
            "type": "i64"
          },
          {
            "name": "pools",
            "docs": [
              "Lamports staked per side: [participant 1, draw, participant 2]."
            ],
            "type": {
              "array": [
                "u64",
                3
              ]
            }
          },
          {
            "name": "state",
            "type": {
              "defined": {
                "name": "marketState"
              }
            }
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "goals",
            "docs": [
              "Final [P1, P2] goals as proven on-chain at settlement."
            ],
            "type": {
              "array": [
                "i32",
                2
              ]
            }
          },
          {
            "name": "settledTsMs",
            "type": "i64"
          },
          {
            "name": "rootsAccount",
            "docs": [
              "The TxOracle roots account the settlement proof was verified against."
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "marketSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "goals",
            "type": {
              "array": [
                "i32",
                2
              ]
            }
          },
          {
            "name": "rootsAccount",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "marketState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "settled"
          }
        ]
      }
    },
    {
      "name": "position",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "side",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "claimed",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "proofNode",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "isRightSibling",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "scoreStat",
      "docs": [
        "The on-chain representation of a single, provable key-value statistic.",
        "This is the leaf of the inner-most Merkle tree."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "key",
            "type": "u32"
          },
          {
            "name": "value",
            "type": "i32"
          },
          {
            "name": "period",
            "type": "i32"
          }
        ]
      }
    },
    {
      "name": "scoresBatchSummary",
      "docs": [
        "The summary for a single fixture's scores events within a 5-minute batch.",
        "This contains the root of the sub-tree of all events for that fixture."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "updateStats",
            "type": {
              "defined": {
                "name": "scoresUpdateStats"
              }
            }
          },
          {
            "name": "eventsSubTreeRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "scoresUpdateStats",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "updateCount",
            "type": "i32"
          },
          {
            "name": "minTimestamp",
            "type": "i64"
          },
          {
            "name": "maxTimestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "statTerm",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "statToProve",
            "type": {
              "defined": {
                "name": "scoreStat"
              }
            }
          },
          {
            "name": "eventStatRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "statProof",
            "type": {
              "vec": {
                "defined": {
                  "name": "proofNode"
                }
              }
            }
          }
        ]
      }
    }
  ]
};
