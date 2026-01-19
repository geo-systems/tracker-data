import fs from 'fs';
import os from 'os';
import path from 'path';
import { SystemClock } from '../../common/SystemClock.ts';
import { RegisterFS } from '../RegisterFS.ts';

describe('RegisterFS', () => {
    let testDataDir: string;
    let testRegisterPath: string;
    
    beforeEach(() => {
        // Create a unique temporary directory for each test
        testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registerfs-test-'));
        testRegisterPath = path.join(testDataDir, 'register', 'register.json');
        
        // Create the register subdirectory
        fs.mkdirSync(path.join(testDataDir, 'register'), { recursive: true });
    });
    
    afterEach(() => {
        // Clean up the temporary directory
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
    });
    
    describe('constructor', () => {
        it('should use default data directory when none provided', () => {
            const register = new RegisterFS();
            expect(register).toBeInstanceOf(RegisterFS);
        });
        
        it('should use provided data directory', () => {
            const register = new RegisterFS(testDataDir);
            expect(register).toBeInstanceOf(RegisterFS);
        });
    });
    
    describe('getItemLastUpdated', () => {
        it('should return null when register file does not exist', () => {
            // Delete the register file
            fs.rmSync(testRegisterPath, { force: true });
            
            const register = new RegisterFS(testDataDir);
            const result = register.getItemLastUpdated('test-key');
            
            expect(result).toBeNull();
        });
        
        it('should return null when key does not exist in register', () => {
            fs.writeFileSync(testRegisterPath, JSON.stringify({ 'other-key': 12345 }));
            
            const register = new RegisterFS(testDataDir);
            const result = register.getItemLastUpdated('test-key');
            
            expect(result).toBeNull();
        });
        
        it('should return timestamp when key exists in register', () => {
            fs.writeFileSync(testRegisterPath, JSON.stringify({ 'test-key': 99999 }));
            
            const register = new RegisterFS(testDataDir);
            const result = register.getItemLastUpdated('test-key');
            
            expect(result).toBe(99999);
        });
    });
    
    describe('getItem', () => {
        it('should return null when item file does not exist', () => {
            const register = new RegisterFS(testDataDir);
            const result = register.getItem('test-key');
            
            expect(result).toBeNull();
        });
        
        it('should return parsed JSON when item file exists', () => {
            const testData = { name: 'test', value: 42 };
            fs.writeFileSync(path.join(testDataDir, 'test-key.json'), JSON.stringify(testData));
            
            const register = new RegisterFS(testDataDir);
            const result = register.getItem('test-key');
            
            expect(result).toEqual(testData);
        });
        
        it('should handle arrays', () => {
            const testData = [1, 2, 3, 4, 5];
            fs.writeFileSync(path.join(testDataDir, 'array-key.json'), JSON.stringify(testData));
            
            const register = new RegisterFS(testDataDir);
            const result = register.getItem('array-key');
            
            expect(result).toEqual(testData);
        });
    });
    
    describe('getItemAndTimestamp', () => {
        it('should return both null when neither exists', () => {
            const register = new RegisterFS(testDataDir);
            const result = register.getItemAndTimestamp('test-key');
            
            expect(result).toEqual({ data: null, lastUpdated: null });
        });
        
        it('should return data and timestamp when both exist', () => {
            const testData = { value: 123 };
            const testTimestamp = 55555;
            
            fs.writeFileSync(path.join(testDataDir, 'test-key.json'), JSON.stringify(testData));
            fs.writeFileSync(testRegisterPath, JSON.stringify({ 'test-key': testTimestamp }));
            
            const register = new RegisterFS(testDataDir);
            const result = register.getItemAndTimestamp('test-key');
            
            expect(result).toEqual({ data: testData, lastUpdated: testTimestamp });
        });
        
        it('should return data but null timestamp when only data exists', () => {
            const testData = { value: 123 };
            
            fs.writeFileSync(path.join(testDataDir, 'test-key.json'), JSON.stringify(testData));
            fs.rmSync(testRegisterPath, { force: true });
            
            const register = new RegisterFS(testDataDir);
            const result = register.getItemAndTimestamp('test-key');
            
            expect(result).toEqual({ data: testData, lastUpdated: null });
        });
    });
    
    describe('setItem', () => {
        it('should write data file and update register when value provided', () => {
            const testData = { name: 'test', count: 42 };
            const beforeTime = Date.now();
            
            const register = new RegisterFS(testDataDir);
            register.setItem('test-key', testData);
            
            const afterTime = Date.now();
            
            // Verify data file was written
            const dataPath = path.join(testDataDir, 'test-key.json');
            expect(fs.existsSync(dataPath)).toBe(true);
            expect(JSON.parse(fs.readFileSync(dataPath, 'utf-8'))).toEqual(testData);
            
            // Verify register was updated with a recent timestamp
            expect(fs.existsSync(testRegisterPath)).toBe(true);
            const registerData = JSON.parse(fs.readFileSync(testRegisterPath, 'utf-8'));
            expect(registerData['test-key']).toBeGreaterThanOrEqual(beforeTime);
            expect(registerData['test-key']).toBeLessThanOrEqual(afterTime);
        });
        
        it('should only update register when value is undefined', () => {
            const beforeTime = Date.now();
            
            const register = new RegisterFS(testDataDir);
            register.setItem('test-key', undefined);
            
            const afterTime = Date.now();
            
            // Verify data file was not written
            const dataPath = path.join(testDataDir, 'test-key.json');
            expect(fs.existsSync(dataPath)).toBe(false);
            
            // Verify register was updated
            const registerData = JSON.parse(fs.readFileSync(testRegisterPath, 'utf-8'));
            expect(registerData['test-key']).toBeGreaterThanOrEqual(beforeTime);
            expect(registerData['test-key']).toBeLessThanOrEqual(afterTime);
        });
        
        it('should only update register when value is null', () => {
            const beforeTime = Date.now();
            
            const register = new RegisterFS(testDataDir);
            register.setItem('test-key', null);
            
            const afterTime = Date.now();
            
            // Verify data file was not written
            const dataPath = path.join(testDataDir, 'test-key.json');
            expect(fs.existsSync(dataPath)).toBe(false);
            
            // Verify register was updated
            const registerData = JSON.parse(fs.readFileSync(testRegisterPath, 'utf-8'));
            expect(registerData['test-key']).toBeGreaterThanOrEqual(beforeTime);
            expect(registerData['test-key']).toBeLessThanOrEqual(afterTime);
        });
        
        it('should preserve existing register entries', () => {
            const existingRegister = { 'old-key': 12345, 'another-key': 67890 };
            fs.writeFileSync(testRegisterPath, JSON.stringify(existingRegister));
            
            const register = new RegisterFS(testDataDir);
            register.setItem('new-key', { data: 'new' });
            
            const registerData = JSON.parse(fs.readFileSync(testRegisterPath, 'utf-8'));
            expect(registerData['old-key']).toBe(12345);
            expect(registerData['another-key']).toBe(67890);
            expect(registerData['new-key']).toBeGreaterThan(0);
        });
        
        it('should update timestamp for existing key', () => {
            const oldTimestamp = 12345;
            const existingRegister = { 'test-key': oldTimestamp };
            fs.writeFileSync(testRegisterPath, JSON.stringify(existingRegister));
            
            const register = new RegisterFS(testDataDir);
            register.setItem('test-key', { data: 'updated' });
            
            const registerData = JSON.parse(fs.readFileSync(testRegisterPath, 'utf-8'));
            expect(registerData['test-key']).toBeGreaterThan(oldTimestamp);
        });
        
        it('should use clock for timestamps', () => {
            const beforeTime = Date.now();
            
            const register = new RegisterFS(testDataDir, new SystemClock());
            register.setItem('test-key', { value: 'test' });
            
            const afterTime = Date.now();
            
            const registerData = JSON.parse(fs.readFileSync(testRegisterPath, 'utf-8'));
            expect(registerData['test-key']).toBeGreaterThanOrEqual(beforeTime);
            expect(registerData['test-key']).toBeLessThanOrEqual(afterTime);
        });
        
        it('should handle arrays as values', () => {
            const testArray = [1, 2, 3];
            
            const register = new RegisterFS(testDataDir);
            register.setItem('array-key', testArray);
            
            const dataPath = path.join(testDataDir, 'array-key.json');
            expect(JSON.parse(fs.readFileSync(dataPath, 'utf-8'))).toEqual(testArray);
        });
    });
});
