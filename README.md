# OctoWatch - Octopus Tracking Visualizer

## What is OctoWatch?
OctoWatch is a tool that helps you visualize and analyze octopus behavior from video recordings. You can upload videos and see heatmaps, trajectories, and other visualizations of octopus movement.

## Before You Start
Don't worry if you've never used the terminal before! We'll walk you through each step. The terminal (also called "command line") is just a text-based way to give instructions to your computer.

### What You'll Need:
- A computer running Windows or Mac
- About 30 minutes for the initial setup
- An internet connection to download the necessary files

## Installation Guide

### Step 1: Open Your Terminal
**On Mac:**
1. Press `Command + Space` to open Spotlight search
2. Type "Terminal" and press Enter
3. A black or white window with text will appear - this is your terminal!

**On Windows:**
1. Click the Start button
2. Type "PowerShell" in the search bar
3. Click on "Windows PowerShell" (NOT "PowerShell ISE")
4. A blue window with white text will appear - this is your terminal!

### Step 2: Install Conda (a Python Manager)
Conda helps manage the programming environment for OctoWatch.

1. Go to this website: https://www.anaconda.com/download/success
2. Scroll down to find the section labeled **"Miniconda Installers"** (on the right side)
3. Find your operating system (Windows or macOS)
4. Click on **"Graphical Installer"** for your system
5. A file will download - open it when it's done
6. Follow the installer instructions:
   - Click "Next" or "Continue" through the screens
   - Accept the license agreement
   - Use the default installation location (just click "Next")
   - When it's done, click "Finish"

### Step 3: Install Git (a File Downloader)
Git helps you download the OctoWatch program files.

**On Mac:**
1. In your Terminal window, copy and paste this command:
   ```
   xcode-select --install
   ```
2. Press Enter
3. A popup will appear - click "Install"
4. Wait for it to finish (this might take 5-10 minutes)

**On Windows:**
1. Go to: https://git-scm.com/downloads
2. Click on "Windows"
3. Click the "click here to download" link, download will then start
4. Open the downloaded file
5. Click "Next" through all the screens (the default options are fine)
6. Click "Install" and then "Finish"

### Step 4: Download OctoWatch
Now we'll download the actual OctoWatch program.

1. In your terminal window, copy and paste this command exactly:
   ```
   git clone https://github.com/MagnascoLab/octoWatch
   ```
2. Press Enter
3. You'll see some text appear - this means it's downloading!
4. When it's done (you'll see your cursor blinking on a new line), type:
   ```
   cd octoWatch
   ```
5. Press Enter (this moves you into the OctoWatch folder)

### Step 5: Set Up the OctoWatch Environment
Now we'll create a special space for OctoWatch to run.

1. Copy and paste this command:
   ```
   conda create -n octowatch python=3.10
   ```
2. Press Enter
3. When it asks "Proceed ([y]/n)?", type `y` and press Enter
4. Wait for it to finish (this might take a few minutes)
5. Then copy and paste:
   ```
   conda activate octowatch
   ```
6. Press Enter

**Note:** You should see `(octowatch)` appear at the beginning of your terminal line. This means you're in the right environment!

### Step 6: Install Required Components
Almost there! Now we install the components OctoWatch needs.

1. Copy and paste this command:
   ```
   pip install -r requirements.txt
   ```
2. Press Enter
3. You'll see lots of text scrolling by - this is normal!
4. Wait for it to finish (this might take 5-10 minutes)

### Step 7: Start OctoWatch!
You're ready to run the program!

1. Copy and paste this command:
   ```
   python app.py
   ```
2. Press Enter
3. You should see text that includes something like "Running on http://localhost:5172"
4. Open your web browser (Chrome, Firefox, Safari, etc.)
5. In the address bar, type exactly: `http://localhost:5172`
6. Press Enter - OctoWatch should appear!

## Using OctoWatch Daily

### Starting OctoWatch Each Time
After the initial setup, starting OctoWatch is much easier:

1. Open your terminal (Terminal on Mac, PowerShell on Windows)
2. Navigate to the OctoWatch folder:
   ```
   cd octoWatch
   ```
3. Activate the environment:
   ```
   conda activate octowatch
   ```
4. Start the program:
   ```
   python app.py
   ```
5. Open your browser and go to: `http://localhost:5172`

### Stopping OctoWatch
When you're done using OctoWatch:
1. Go back to your terminal window
2. Press `Control + C` (on both Mac and Windows)
3. The program will stop
4. You can close the terminal window

### Updating OctoWatch
To keep OctoWatch up-to-date, you can run the following commands periodically:
1. Open your terminal
2. Navigate to the OctoWatch folder
3. Run the following commands - this will pull the latest changes from the GitHub repository and update your environment:
   ```
   git pull
   conda activate octowatch
   pip install -r requirements.txt
   ```

## Using OctoWatch Features

Once OctoWatch is running in your browser, download the "guide.pdf" from the #octo-watch channel on Slack. This guide will help you understand how to upload videos, view heatmaps, and analyze octopus behavior. The guide is based on a slightly outdated GUI, but the basic features are the same.

## Troubleshooting

### "Command not found" error
- Make sure you typed the command exactly as shown (copy-paste is best!)
- On Windows, make sure you're using PowerShell, not Command Prompt - you may additionally need to **enable script execution** by running:
  ```
  Set-ExecutionPolicy RemoteSigned
  ```
  and then confirm with `Y` when prompted.

### "conda: command not found"
- Close your terminal and open a new one
- Try the command again
- If it still doesn't work, you may need to restart your computer

### The webpage won't load
- Make sure the terminal shows "Running on http://localhost:5172"
- Try refreshing your browser
- Make sure you typed the address correctly: `http://localhost:5172`

### "No such file or directory"
- Make sure you're in the right folder
- Type `pwd` (Mac) or `cd` (Windows) to see your current location
- Navigate back to where you downloaded OctoWatch

## Getting Help

If you run into problems:
1. Take a screenshot of any error messages
2. Note which step you're on
3. Send Nathan Breslow a message in the #octo-watch channel on Slack

Remember: You can't break anything by trying these commands! If something goes wrong, you can always close the terminal and start over.