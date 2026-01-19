import { InMemoryRegister } from '../InMemoryRegister.ts';
import { MockClock } from '../../common/MockClock.ts';

describe('InMemoryRegister', () => {
    const mockClock = new MockClock(1000000);

    beforeEach(() => {
        // Reset sleep calls tracking and time
        mockClock.sleepCalls = [];
        mockClock.setNow(1000000);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return null for non-existent items', () => {
        const register = new InMemoryRegister(mockClock);
        
        expect(register.getItem('non-existent')).toBeNull();
        expect(register.getItemLastUpdated('non-existent')).toBeNull();
    });

    it('should store and retrieve items', () => {
        const register = new InMemoryRegister(mockClock);
        const testData = { name: 'test', value: 123 };
        
        register.setItem('test-key', testData);
        
        expect(register.getItem('test-key')).toEqual(testData);
    });

    it('should store timestamp when setting item', () => {
        const register = new InMemoryRegister(mockClock);
        const testData = { name: 'test' };
        
        register.setItem('test-key', testData);
        
        expect(register.getItemLastUpdated('test-key')).toBe(1000000);
    });

    it('should update timestamp when setting item again', () => {
        const register = new InMemoryRegister(mockClock);
        
        register.setItem('test-key', { value: 1 });
        expect(register.getItemLastUpdated('test-key')).toBe(1000000);
        
        mockClock.setNow(2000000);
        register.setItem('test-key', { value: 2 });
        
        expect(register.getItemLastUpdated('test-key')).toBe(2000000);
    });

    it('should set timestamp even without value (like RegisterFS)', () => {
        const register = new InMemoryRegister(mockClock);
        
        register.setItem('test-key');
        
        expect(register.getItemLastUpdated('test-key')).toBe(1000000);
        expect(register.getItem('test-key')).toBeNull();
    });

    it('should return both data and timestamp with getItemAndTimestamp', () => {
        const register = new InMemoryRegister(mockClock);
        const testData = { name: 'test', value: 123 };
        
        register.setItem('test-key', testData);
        
        const result = register.getItemAndTimestamp('test-key');
        
        expect(result).toEqual({
            data: testData,
            lastUpdated: 1000000
        });
    });

    it('should return null data and timestamp for non-existent key', () => {
        const register = new InMemoryRegister(mockClock);
        
        const result = register.getItemAndTimestamp('non-existent');
        
        expect(result).toEqual({
            data: null,
            lastUpdated: null
        });
    });

    it('should clear all data and timestamps', () => {
        const register = new InMemoryRegister(mockClock);
        
        register.setItem('key1', { value: 1 });
        register.setItem('key2', { value: 2 });
        
        expect(register.getItem('key1')).toEqual({ value: 1 });
        expect(register.getItem('key2')).toEqual({ value: 2 });
        
        register.clear();
        
        expect(register.getItem('key1')).toBeNull();
        expect(register.getItem('key2')).toBeNull();
        expect(register.getItemLastUpdated('key1')).toBeNull();
        expect(register.getItemLastUpdated('key2')).toBeNull();
    });

    it('should handle complex nested objects', () => {
        const register = new InMemoryRegister(mockClock);
        const complexData = {
            coins: {
                bitcoin: { price: 50000, symbol: 'BTC' },
                ethereum: { price: 3000, symbol: 'ETH' }
            },
            metadata: {
                timestamp: 1234567890,
                source: 'coingecko'
            }
        };
        
        register.setItem('complex-key', complexData);
        
        expect(register.getItem('complex-key')).toEqual(complexData);
    });

    it('should handle arrays', () => {
        const register = new InMemoryRegister(mockClock);
        const arrayData = [1, 2, 3, 4, 5];
        
        register.setItem('array-key', arrayData);
        
        expect(register.getItem('array-key')).toEqual(arrayData);
    });

    it('should use SystemClock by default', () => {
        const register = new InMemoryRegister();
        const beforeTime = Date.now();
        
        register.setItem('test-key', { value: 1 });
        
        const afterTime = Date.now();
        const timestamp = register.getItemLastUpdated('test-key');
        
        expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
        expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
});
