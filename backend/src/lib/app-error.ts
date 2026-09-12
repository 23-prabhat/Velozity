export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message)
  }
}

export const notFound = () => new AppError(404, 'NOT_FOUND', 'The requested resource was not found.')
