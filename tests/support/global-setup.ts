import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://buber:buber@localhost:5432/buber_test?schema=public";
  if (!/test/.test(url)) throw new Error("Refusing to run tests against a database whose name does not contain 'test'");
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
}
