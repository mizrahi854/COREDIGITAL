export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = () => new AppError(401, "unauthorized", "יש להתחבר כדי להמשיך");
export const forbidden = () => new AppError(403, "forbidden", "אין לך הרשאה לפעולה הזו");
export const notFound = (what = "הפריט") => new AppError(404, "not_found", `${what} לא נמצא`);
export const badRequest = (msg: string) => new AppError(400, "bad_request", msg);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
