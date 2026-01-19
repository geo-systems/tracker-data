import { get, getRetry } from '../fetch';
import { MockClock } from '../MockClock';

// Mock global fetch
global.fetch = jest.fn();

describe('fetch.ts', () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    const mockClock = new MockClock();

    beforeEach(() => {
        jest.clearAllMocks();
        mockClock.sleepCalls = [];
    });

    describe('get', () => {
        const testUrl = 'https://api.example.com/data';

        it('should successfully fetch JSON data', async () => {
            const mockData = { id: 1, name: 'Test' };
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue(mockData),
            } as unknown as Response;

            mockFetch.mockResolvedValue(mockResponse);

            const result = await get<typeof mockData>(testUrl);

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith(testUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        });

        it('should include custom headers when provided', async () => {
            const mockData = { success: true };
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue(mockData),
            } as unknown as Response;

            mockFetch.mockResolvedValue(mockResponse);

            const customHeaders = {
                'Authorization': 'Bearer token123',
                'X-Custom-Header': 'custom-value',
            };

            await get(testUrl, { headers: customHeaders });

            expect(mockFetch).toHaveBeenCalledWith(testUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer token123',
                    'X-Custom-Header': 'custom-value',
                },
            });
        });

        it('should use custom transform function when provided', async () => {
            const mockText = 'Plain text response';
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                text: jest.fn().mockResolvedValue(mockText),
            } as unknown as Response;

            mockFetch.mockResolvedValue(mockResponse);

            const transform = async (resp: Response) => {
                const text = await resp.text();
                return text.toUpperCase();
            };

            const result = await get(testUrl, { transform });

            expect(result).toBe('PLAIN TEXT RESPONSE');
            expect(mockResponse.text).toHaveBeenCalled();
        });

        it('should throw error when response is not ok', async () => {
            const mockResponse = {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            } as Response;

            mockFetch.mockResolvedValue(mockResponse);

            await expect(get(testUrl)).rejects.toThrow(
                `Error fetching data from ${testUrl}: status=500 Internal Server Error`
            );
        });

        it('should throw error for 404 status', async () => {
            const mockResponse = {
                ok: false,
                status: 404,
                statusText: 'Not Found',
            } as Response;

            mockFetch.mockResolvedValue(mockResponse);

            await expect(get(testUrl)).rejects.toThrow(
                `Error fetching data from ${testUrl}: status=404 Not Found`
            );
        });

        it('should throw error for 401 unauthorized', async () => {
            const mockResponse = {
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
            } as Response;

            mockFetch.mockResolvedValue(mockResponse);

            await expect(get(testUrl)).rejects.toThrow(
                `Error fetching data from ${testUrl}: status=401 Unauthorized`
            );
        });

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            await expect(get(testUrl)).rejects.toThrow('Network error');
        });
    });

    describe('getRetry', () => {
        const testUrl = 'https://api.example.com/data';

        it('should return data on first successful attempt', async () => {
            const mockData = { result: 'success' };
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue(mockData),
            } as unknown as Response;

            mockFetch.mockResolvedValue(mockResponse);

            const result = await getRetry<typeof mockData>(mockClock, testUrl, {});

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockClock.sleepCalls).toHaveLength(1); // Initial jitter sleep
        });

        it('should retry on failure and succeed on second attempt', async () => {
            const mockData = { result: 'success' };
            const mockErrorResponse = {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            } as Response;
            const mockSuccessResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue(mockData),
            } as unknown as Response;

            mockFetch
                .mockResolvedValueOnce(mockErrorResponse)
                .mockResolvedValueOnce(mockSuccessResponse);

            const result = await getRetry<typeof mockData>(mockClock, testUrl, {
                retries: 3,
                delayMs: 1000,
                jitterMs: 100,
            });

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockClock.sleepCalls).toHaveLength(3); // Jitter before attempt 1, delay after fail 1, jitter before attempt 2
        });

        it('should return null immediately on 404 error without retrying', async () => {
            const mockResponse = {
                ok: false,
                status: 404,
                statusText: 'Not Found',
            } as Response;

            mockFetch.mockResolvedValue(mockResponse);

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const result = await getRetry(mockClock, testUrl, { retries: 3 });

            expect(result).toBeNull();
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Resource not found')
            );

            consoleSpy.mockRestore();
        });

        it('should throw error after exhausting all retries', async () => {
            const mockResponse = {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            } as Response;

            mockFetch.mockResolvedValue(mockResponse);

            await expect(
                getRetry(mockClock, testUrl, { retries: 3, delayMs: 100, jitterMs: 10 })
            ).rejects.toThrow(`Failed to fetch data from ${testUrl} after 3 retries`);

            expect(mockFetch).toHaveBeenCalledTimes(3);
        });

        it('should use default retry options when not provided', async () => {
            const mockResponse = {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            } as Response;

            mockFetch.mockResolvedValue(mockResponse);

            await expect(getRetry(mockClock, testUrl, {})).rejects.toThrow(
                `Failed to fetch data from ${testUrl} after 3 retries`
            );

            expect(mockFetch).toHaveBeenCalledTimes(3); // Default retries = 3
        });

        it('should apply custom retry options', async () => {
            const mockResponse = {
                ok: false,
                status: 503,
                statusText: 'Service Unavailable',
            } as Response;

            mockFetch.mockResolvedValue(mockResponse);

            await expect(
                getRetry(mockClock, testUrl, { retries: 5, delayMs: 500, jitterMs: 50 })
            ).rejects.toThrow(`Failed to fetch data from ${testUrl} after 5 retries`);

            expect(mockFetch).toHaveBeenCalledTimes(5);
        });

        it('should pass custom headers through to get function', async () => {
            const mockData = { result: 'success' };
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue(mockData),
            } as unknown as Response;

            mockFetch.mockResolvedValue(mockResponse);

            const customHeaders = { 'X-API-Key': 'secret' };

            await getRetry(mockClock, testUrl, { headers: customHeaders });

            expect(mockFetch).toHaveBeenCalledWith(testUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'secret',
                },
            });
        });

        it('should pass transform function through to get function', async () => {
            const mockText = 'test response';
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                text: jest.fn().mockResolvedValue(mockText),
            } as unknown as Response;

            mockFetch.mockResolvedValue(mockResponse);

            const transform = async (resp: Response) => {
                const text = await resp.text();
                return text.length;
            };

            const result = await getRetry(mockClock, testUrl, { transform });

            expect(result).toBe(13); // length of 'test response'
        });

        it('should handle retry with increasing delays', async () => {
            const mockResponse = {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            } as Response;

            mockFetch.mockResolvedValue(mockResponse);

            await expect(
                getRetry(mockClock, testUrl, { retries: 3, delayMs: 1000, jitterMs: 100 })
            ).rejects.toThrow();

            // Should have: jitter before each attempt (3) + delay after each failure (3)
            // Total sleep calls: 3 (jitter before attempts) + 3 (delays after failures) = 6
            expect(mockClock.sleepCalls).toHaveLength(6);
        });
    });
});
