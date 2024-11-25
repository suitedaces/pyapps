import { LRUCache } from 'lru-cache'
import { NextRequest } from 'next/server'

export interface RateLimitOptions {
    uniqueTokenPerInterval?: number
    interval?: number
}

export interface RateLimiter {
    check: (req: NextRequest, limit: number, token: string) => Promise<void>
}

export function rateLimit(options?: RateLimitOptions): RateLimiter {
    const tokenCache = new LRUCache({
        max: options?.uniqueTokenPerInterval || 500,
        ttl: options?.interval || 60000,
    })

    return {
        check: async (req: NextRequest, limit: number, token: string) => {
            const tokenCount = (tokenCache.get(token) as number[]) || [0]
            if (tokenCount[0] === 0) {
                tokenCache.set(token, [1])
            } else {
                tokenCount[0] += 1
                tokenCache.set(token, tokenCount)
            }

            const currentUsage = tokenCount[0]
            const isRateLimited = currentUsage >= limit

            if (isRateLimited) {
                throw new Error(`Rate limit exceeded for token: ${token}`)
            }
        },
    }
} 