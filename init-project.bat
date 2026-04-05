@echo off
echo ========================================================
echo   🚀 INITIALIZING PROFESSIONAL VITE WORKSPACE
echo ========================================================
echo.

echo [1/4] Restructuring files into src/ and public/...
node setup_workspace.js
echo.

echo [2/4] Installing NPM dependencies...
call npm install
echo.

echo [3/4] Initializing Git repository...
git init
git add .
git commit -m "build: scaffold enterprise vite workspace with CI/CD"
git branch -M main
echo.

echo ========================================================
echo   ✅ Local Setup Complete!
echo ========================================================
echo.
echo Make sure you have created an empty repository called
echo "tip-dashboard" on your GitHub account first.
echo.
echo Enter your GitHub username below to push the code,
echo or just press Enter to skip and start the server.
set /p GH_USER="GitHub Username: "

if "%GH_USER%"=="" (
    echo.
    echo Skipping GitHub push. You can push manually later.
    echo.
    echo 🚀 Starting Development Server...
    call npm run dev
    goto :eof
)

echo.
echo [4/4] Linking and pushing to GitHub...
git remote add origin https://github.com/%GH_USER%/tip-dashboard.git
git push -u origin main
echo.

echo 🎉 All done! Starting development server...
call npm run dev
