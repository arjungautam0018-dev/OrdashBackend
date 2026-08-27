import crypto from "crypto";

export const generateTableCode = () => {
    return crypto.randomInt(10000,100000).toString();
};
