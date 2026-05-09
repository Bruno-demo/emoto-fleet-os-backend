SELECT u.email, u.role, u.status, f.name AS fleet
FROM "User" u
JOIN "Fleet" f ON u."fleetId" = f.id
WHERE f.name LIKE '%HQ%'
LIMIT 5;
