@echo off
echo Updating code on server...
set PASSWORD=1361865Hjh!
plink -ssh -l root -pw %PASSWORD% 112.124.57.134 "cd /var/www/db-performance-insight-platform && git pull origin master"
echo Done!
