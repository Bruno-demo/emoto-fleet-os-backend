SELECT u.email, u."passwordHash", u.role, u.status, f.name AS fleet
FROM "User" u
JOIN "Fleet" f ON u."fleetId" = f.id
WHERE f.name = 'E-Moto HQ'
LIMIT 3;
