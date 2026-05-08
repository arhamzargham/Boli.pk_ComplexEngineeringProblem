@echo off
echo Boli.pk — Phase 2 seed data
echo Running seed_phase2.sql against boli-postgres-1 ...
type "%~dp0seed_phase2.sql" | docker exec -i boli-postgres-1 psql -U boli -d boli
echo.
echo Done.
pause
