import "dotenv/config";

// If TypeScript complains, it's just a type resolution issue in Prisma v7.
// @ts-ignore
import { defineConfig } from "prisma/config"; 

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
