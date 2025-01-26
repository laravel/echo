module.exports = {
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                isolatedModules: true
            }
        ],
    },
    extensionsToTreatAsEsm: [".ts"],
    testEnvironment: "node",
};
