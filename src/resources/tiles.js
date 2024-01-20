export const LINE_TYPES = {
    ROAD: "ROAD",
    WALL: "WALL",
    RIVER: "RIVER",
    BRIDGE: "BRIDGE",
}

export const TILE_TYPES = {
    TYPE_1: {
        totalCount: 1,
        totalShieldsCount: 1,
        options: {
            isFullTileTown: true,
            lines: []
        }
    },
    TYPE_2: {
        totalCount: 1,
        options: {
            lines: [
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 1, y: 0 },
                        { x: 1, y: 1 },
                    ]
                },
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 2, y: 1 },
                        { x: 1, y: 1 },
                    ]
                },
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 1, y: 1 },
                        { x: 1, y: 2 },
                    ]
                },
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 0, y: 1 },
                        { x: 1, y: 1 },
                    ]
                }
            ]
        }
    },
    TYPE_3: {
        totalCount: 2,
        options: {
            lines: [
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 1, y: 0 },
                        { x: 1, y: 1 },
                    ]
                },
            ]
        }
    },
    TYPE_4: {
        totalCount: 2,
        totalGardensCount: 1,
        options: {
            lines: [
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 2, y: 2 },
                        { x: 0, y: 2 },
                    ]
                },
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 2, y: 0 },
                        { x: 2, y: 2 },
                    ]
                },
            ]
        }
    },
    TYPE_5: {
        totalCount: 3,
        options: {
            lines: [
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 2, y: 2 },
                        { x: 0, y: 2 },
                    ]
                },
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 0, y: 1 },
                        { x: 1, y: 0 },
                    ]
                },
            ]
        }
    },
    TYPE_6: {
        totalCount: 3,
        options: {
            lines: [
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 1, y: 0 },
                        { x: 1, y: 1 },
                    ]
                },
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 2, y: 1 },
                        { x: 1, y: 1 },
                    ]
                },
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 0, y: 1 },
                        { x: 1, y: 1 },
                    ]
                },
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 2, y: 2 },
                        { x: 0, y: 2 },
                    ]
                },
            ]
        }
    },
    TYPE_7: {
        totalCount: 3,
        options: {
            lines: [
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 2, y: 2 },
                        { x: 0, y: 2 },
                    ]
                },
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 1, y: 0 },
                        { x: 2, y: 1 },
                    ]
                },
            ]
        }
    },
    TYPE_8: {
        totalCount: 3,
        totalShieldsCount: 2,
        options: {
            lines: [
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 0, y: 2 },
                        { x: 2, y: 2 },
                    ]
                },
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 1, y: 1 },
                        { x: 1, y: 2 },
                    ]
                },
            ]
        }
    },
    TYPE_9: {
        totalCount: 3,
        totalGardensCount: 1,
        options: {
            lines: [
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 2, y: 2 },
                        { x: 0, y: 2 },
                    ]
                },
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 0, y: 0 },
                        { x: 2, y: 0 },
                    ]
                },
            ]
        }
    },
    TYPE_10: {
        totalCount: 3,
        totalShieldsCount: 2,
        options: {
            lines: [
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 0, y: 2 },
                        { x: 2, y: 2 },
                    ]
                },
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 2, y: 0 },
                        { x: 0, y: 0 },
                    ]
                },
            ]
        }
    },
    TYPE_11: {
        totalCount: 3,
        options: {
            lines: [
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 2, y: 2 },
                        { x: 0, y: 2 },
                    ]
                },
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 0, y: 1 },
                        { x: 2, y: 1 },
                    ]
                },
            ]
        }
    },
    TYPE_12: {
        totalCount: 4,
        options: {
            isMonastery: true,
        }
    },
    TYPE_13: {
        totalCount: 4,
        options: {
            lines: [
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 1, y: 0 },
                        { x: 1, y: 1 },
                    ]
                },
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 2, y: 1 },
                        { x: 1, y: 1 },
                    ]
                },
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 0, y: 1 },
                        { x: 1, y: 1 },
                    ]
                }
            ]
        }
    },
    TYPE_14: {
        totalCount: 4,
        totalShieldsCount: 1,
        options: {
            lines: [
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 0, y: 2 },
                        { x: 2, y: 2 },
                    ]
                },
            ]
        }
    },
    TYPE_15: {
        totalCount: 5,
        totalGardensCount: 1,
        options: {
            lines: [
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 2, y: 2 },
                        { x: 0, y: 2 },
                    ]
                },
            ]
        }
    },
    TYPE_16: {
        totalCount: 5,
        totalShieldsCount: 2,
        totalGardensCount: 1,
        options: {
            lines: [
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 2, y: 0 },
                        { x: 0, y: 2 },
                    ]
                },
            ]
        }
    },
    TYPE_17: {
        totalCount: 5,
        totalShieldsCount: 2,
        options: {
            lines: [
                {
                    type: LINE_TYPES.WALL,
                    points: [
                        { x: 2, y: 2 },
                        { x: 0, y: 0 },
                    ]
                },
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 1, y: 0 },
                        { x: 2, y: 1 },
                    ]
                },
            ]
        }
    },
    TYPE_18: {
        totalCount: 8,
        totalShieldsCount: 1,
        options: {
            lines: [
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 1, y: 0 },
                        { x: 1, y: 2 },
                    ]
                },
            ]
        }
    },
    TYPE_19: {
        totalCount: 9,
        totalShieldsCount: 1,
        options: {
            lines: [
                {
                    type: LINE_TYPES.ROAD,
                    points: [
                        { x: 1, y: 2 },
                        { x: 2, y: 1 },
                    ]
                },
            ]
        }
    },
}

export const tilePointTypes = {
    LB: { x: 0, y: 0 },
    LM: { x: 0, y: 1 },
    LT: { x: 0, y: 2 },
    BM: { x: 1, y: 0 },
    RT: { x: 2, y: 2 },
    RM: { x: 2, y: 1 },
    RB: { x: 2, y: 0 },
    TM: { x: 1, y: 2 },
    C: { x: 1, y: 1 },
}