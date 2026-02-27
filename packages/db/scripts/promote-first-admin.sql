UPDATE "user" SET role = 'ADMIN' WHERE id = (SELECT id FROM "user" ORDER BY "createdAt" ASC LIMIT 1);
