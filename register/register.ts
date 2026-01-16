import fs from 'fs';

const registerFilePath = './data/register/register.json';
export const getRegisterItemLastUpdated = (key: string): any => {
    if (!fs.existsSync(registerFilePath)) {
        return null;
    }
    const register = JSON.parse(fs.readFileSync(registerFilePath, 'utf-8'));
    return register[key] || null;
}

export const getRegisterItem = (key: string): any => {
    const keyFile = `./data/${key}.json`;
    if (!fs.existsSync(keyFile)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(keyFile, 'utf-8'));
}

export const getRegisterItemAndTimestamp = (key: string): { data: any, lastUpdated: number | null } => {
    const data = getRegisterItem(key);
    const lastUpdated = getRegisterItemLastUpdated(key);
    return { data, lastUpdated };
}

export const setRegisterItem = (key: string, value?: any): void => {
    if (value != undefined ) {
        const keyFile = `./data/${key}.json`;
        fs.writeFileSync(keyFile, JSON.stringify(value, null, 2), 'utf-8');
    }

    let register: any = {};
    if (fs.existsSync(registerFilePath)) {
        register = JSON.parse(fs.readFileSync(registerFilePath, 'utf-8'));
    }
    register[key] = Date.now();
    fs.writeFileSync(registerFilePath, JSON.stringify(register, null, 2), 'utf-8');
}