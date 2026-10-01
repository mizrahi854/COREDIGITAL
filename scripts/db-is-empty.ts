import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
prisma.user
  .count()
  .then((n) => console.log(n === 0 ? "empty" : "has-data"))
  .finally(() => prisma.$disconnect());
