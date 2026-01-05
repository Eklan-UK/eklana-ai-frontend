// Better Auth route handler for Next.js App Router
// This catches all /api/v1/auth/* routes
import { NextRequest } from 'next/server';
import { toNodeHandler } from 'better-auth/node';
import { getAuth, initializeBetterAuth } from '@/lib/api/better-auth';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';

let authHandler: ReturnType<typeof toNodeHandler> | null = null;
let isInitialized = false;

// Initialize Better Auth on first request
async function ensureInitialized() {
	if (isInitialized && authHandler) {
		return;
	}

	try {
		// Connect to database
		await connectToDatabase();
		
		// Initialize Better Auth
		await initializeBetterAuth();
		
		// Get auth instance
		const auth = await getAuth();
		
		if (auth) {
			authHandler = toNodeHandler(auth);
			isInitialized = true;
		}
	} catch (error: any) {
		logger.error('Failed to initialize Better Auth', {
			error: error.message,
			stack: error.stack,
		});
	}
}

// Helper to handle all HTTP methods
async function handleRequest(req: NextRequest) {
	await ensureInitialized();
	
	if (!authHandler) {
		return Response.json(
			{
				code: 'ServiceUnavailable',
				message: 'Better Auth is not configured',
			},
			{ status: 503 }
		);
	}

	try {
		// Create a Node.js-compatible request object
		const url = new URL(req.url);
		const headers: Record<string, string> = {};
		req.headers.forEach((value, key) => {
			headers[key] = value;
		});

		// Get body for POST/PUT/PATCH requests
		// Better Auth expects body to be readable, so we'll handle it differently
		let body: string | undefined = undefined;
		const contentType = req.headers.get('content-type') || '';
		
		if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE') {
			try {
				const bodyText = await req.text();
				// Only set body if it's not empty and content-type suggests JSON
				if (bodyText && bodyText.trim().length > 0) {
					body = bodyText;
				}
			} catch (error) {
				// Body might be empty or already consumed
				body = undefined;
			}
		}

		// Create a simple response object that Better Auth can write to
		let statusCode = 200;
		const responseHeaders: Record<string, string> = {};
		let responseBody = '';

		// Create request object - Better Auth's toNodeHandler expects specific format
		const nodeReq = {
			method: req.method,
			url: url.pathname + url.search,
			headers,
			// Only include body if it exists and is not empty
			...(body ? { body } : {}),
		} as any;

		const nodeRes = {
			statusCode: 200,
			status: 200,
			headers: responseHeaders,
			body: responseBody,
			setHeader(name: string, value: string | string[]) {
				if (Array.isArray(value)) {
					this.headers[name] = value.join(', ');
				} else {
					this.headers[name] = value;
				}
			},
			getHeader(name: string) {
				return this.headers[name];
			},
			removeHeader(name: string) {
				delete this.headers[name];
			},
			writeHead(statusCode: number, statusMessage?: string, headers?: Record<string, string | string[]>) {
				this.statusCode = statusCode;
				this.status = statusCode;
				if (headers) {
					Object.entries(headers).forEach(([key, value]) => {
						if (Array.isArray(value)) {
							this.headers[key] = value.join(', ');
						} else {
							this.headers[key] = value;
						}
					});
				}
			},
			write(chunk: string | Buffer) {
				if (typeof chunk === 'string') {
					this.body += chunk;
				} else {
					this.body += chunk.toString('utf-8');
				}
			},
			end(chunk?: string | Buffer) {
				if (chunk) {
					if (typeof chunk === 'string') {
						this.body += chunk;
					} else {
						this.body += chunk.toString('utf-8');
					}
				}
				// Response is complete
			},
		} as any;

		try {
			await authHandler(nodeReq, nodeRes);
		} catch (handlerError: any) {
			// If Better Auth throws an error (like JSON parse), log it but try to continue
			logger.error('Better Auth handler execution error', {
				error: handlerError.message,
				stack: handlerError.stack,
				method: req.method,
				url: url.pathname,
			});
			
			// If it's a JSON parse error, it might be from empty body - try to return a proper error
			if (handlerError.message?.includes('JSON') || handlerError.message?.includes('parse')) {
				return Response.json(
					{
						code: 'BadRequest',
						message: 'Invalid request body',
					},
					{ status: 400 }
				);
			}
			
			// Re-throw other errors
			throw handlerError;
		}

		// Create Next.js Response
		let responseData: any = {};
		if (nodeRes.body) {
			try {
				// Try to parse as JSON
				const trimmedBody = nodeRes.body.trim();
				if (trimmedBody) {
					responseData = JSON.parse(trimmedBody);
				}
			} catch (parseError) {
				// If not JSON, return as text
				responseData = { message: nodeRes.body };
			}
		}

		const response = Response.json(
			responseData,
			{ 
				status: nodeRes.statusCode || 200,
				headers: nodeRes.headers,
			}
		);

		return response;
	} catch (error: any) {
		logger.error('Better Auth handler error', {
			error: error.message,
			stack: error.stack,
		});
		return Response.json(
			{
				code: 'InternalServerError',
				message: 'Better Auth handler error',
			},
			{ status: 500 }
		);
	}
}

export async function GET(req: NextRequest) {
	return handleRequest(req);
}

export async function POST(req: NextRequest) {
	return handleRequest(req);
}

export async function PUT(req: NextRequest) {
	return handleRequest(req);
}

export async function DELETE(req: NextRequest) {
	return handleRequest(req);
}

export async function PATCH(req: NextRequest) {
	return handleRequest(req);
}


