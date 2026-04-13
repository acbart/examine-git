export default {
    testEnvironment: "jsdom",
    setupFilesAfterEnv: ["<rootDir>/tests/setupTests.ts"],
    testMatch: ["<rootDir>/tests/**/*.(spec).(ts|tsx)"],
    testPathIgnorePatterns: ["<rootDir>/tests/e2e/"],
    transform: {
        "^.+\\.(js|jsx|ts|tsx)$": [
            "@swc/jest",
            {
                sourceMaps: true,
                jsc: {
                    parser: {
                        syntax: "typescript",
                        tsx: true,
                    },
                    transform: {
                        react: {
                            runtime: "automatic",
                        },
                    },
                },
            },
        ],
    },
    moduleNameMapper: {
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
        "\\.(jpg|jpeg|png|gif|eot|otf|webp|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|svg)$":
            "jest-transform-stub",
        // Force @codemirror/state and @codemirror/view to use a single instance
        // to avoid conflicts between nested 0.20.x and top-level 6.x versions
        "^@codemirror/state$": "<rootDir>/node_modules/@codemirror/state/dist/index.cjs",
        "^@codemirror/view$": "<rootDir>/node_modules/@codemirror/view/dist/index.cjs",
    },
};
