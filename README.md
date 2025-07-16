# OctoWatch - Octopus Tracking Visualizer

## Installation

### Prerequisites
- Python 3.10
- Conda (Miniconda or Anaconda)

### Setup Instructions

1. **Install Conda** (if not already installed)
   
   Download and install Miniconda from: https://docs.conda.io/en/latest/miniconda.html
   
   Or install Anaconda from: https://www.anaconda.com/products/distribution

2. **Create a Virtual Environment**
   ```bash
   conda create -n octowatch python=3.10.17
   conda activate octowatch
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Application**
   ```bash
   python app.py
   ```

   The application will start and be accessible at: http://localhost:5172

## Quick Start

1. Open your web browser and navigate to http://localhost:5172
2. Upload a video file and corresponding keyframes JSON file
3. Or use a quick-load code if you have one
4. Use the visualization controls to analyze octopus behavior

## Features

- Real-time octopus tracking visualization
- Activity and proximity heatmaps
- Trajectory tracking
- Spatial heatmap analysis
- Frame-by-frame navigation
- Video playback controls

## File Structure

- `videos/` - Stores uploaded video files
- `videos_keyframes/` - Stores keyframe JSON files
- `uploads/` - Temporary upload directory
- `static/` - Frontend JavaScript and CSS files
- `templates/` - HTML templates