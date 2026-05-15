SELECT u.email, u.role, f.name FROM "User" u JOIN "Fleet" f ON u."fleetId" = f.id LIMIT 10;
