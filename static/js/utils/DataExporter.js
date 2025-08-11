/**
 * DataExporter - Utility for exporting analysis data in various formats
 * Handles JSON, CSV, and image exports for all analysis types
 */

export class DataExporter {
    /**
     * Create a DataExporter
     * @param {string} videoFilename - Current video filename for naming exports
     */
    constructor(videoFilename = null) {
        this.videoFilename = videoFilename || 'octopus_video';
        this.baseFilename = this.videoFilename.replace(/\.[^/.]+$/, '');
        this.postfix = this.getExportPostfix();
    }
    
    /**
     * Set video filename
     * @param {string} filename - Video filename
     */
    setVideoFilename(filename) {
        this.videoFilename = filename;
        this.baseFilename = filename ? filename.replace(/\.[^/.]+$/, '') : 'octopus_video';
    }
    
    /**
     * Get export postfix from localStorage
     * @returns {string} The saved postfix or empty string
     */
    getExportPostfix() {
        return localStorage.getItem('exportPostfix') || '';
    }
    
    /**
     * Set export postfix and save to localStorage
     * @param {string} postfix - The postfix to set (max 8 alphanumeric chars)
     */
    setExportPostfix(postfix) {
        // Validate: only alphanumeric, max 8 chars
        const validated = postfix.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
        this.postfix = validated;
        localStorage.setItem('exportPostfix', validated);
    }
    
    /**
     * Generate filename with optional postfix
     * @param {string} baseName - Base filename without extension
     * @param {string} extension - File extension (e.g., 'json', 'csv', 'png')
     * @returns {string} Complete filename with postfix if set
     */
    generateFilename(baseName, extension) {
        if (this.postfix) {
            return `${baseName}_${this.postfix}.${extension}`;
        }
        return `${baseName}.${extension}`;
    }
    
    /**
     * Export heatmap data as JSON
     * @param {Object} heatmapData - Heatmap data from HeatmapCalculator
     * @param {string} side - Which side to export ('left', 'right', or 'both')
     */
    exportHeatmapJSON(heatmapData, side = 'both') {
        const exportData = {
            video_filename: this.videoFilename,
            export_date: new Date().toISOString(),
            heatmap_data: {
                width: heatmapData.heatmapWidth,
                height: heatmapData.heatmapHeight
            }
        };
        
        if (side === 'left' || side === 'both') {
            exportData.heatmap_data.left = {
                data: Array.from(heatmapData.leftHeatmap),
                max_value: heatmapData.leftMaxValue
            };
        }
        
        if (side === 'right' || side === 'both') {
            exportData.heatmap_data.right = {
                data: Array.from(heatmapData.rightHeatmap),
                max_value: heatmapData.rightMaxValue
            };
        }
        
        const filename = this.generateFilename(`${this.baseFilename}_heatmap_data`, 'json');
        this.downloadJSON(exportData, filename);
    }
    
    /**
     * Export trajectory data as JSON
     * @param {Object} trajectoryData - Trajectory data from TrajectoryCalculator
     * @param {Object} videoInfo - Video information
     * @param {string} side - Which side to export
     */
    exportTrajectoryJSON(trajectoryData, videoInfo, side = 'both') {
        const exportData = {
            video_info: {
                filename: this.videoFilename,
                fps: videoInfo.fps,
                total_frames: videoInfo.total_frames_processed,
                width: videoInfo.width,
                height: videoInfo.height
            },
            export_date: new Date().toISOString(),
            trajectories: {}
        };
        
        if ((side === 'left' || side === 'both') && trajectoryData.leftTrajectory) {
            exportData.trajectories.left = trajectoryData.leftTrajectory.map(point => ({
                frame: point.frame,
                x: point.x,
                y: point.y
            }));
        }
        
        if ((side === 'right' || side === 'both') && trajectoryData.rightTrajectory) {
            exportData.trajectories.right = trajectoryData.rightTrajectory.map(point => ({
                frame: point.frame,
                x: point.x,
                y: point.y
            }));
        }
        
        const filename = this.generateFilename(`${this.baseFilename}_trajectories`, 'json');
        this.downloadJSON(exportData, filename);
    }
    
    /**
     * Export trajectory data as CSV
     * @param {Object} trajectoryData - Trajectory data
     * @param {string} side - Which side to export
     */
    exportTrajectoryCSV(trajectoryData, side = 'both') {
        let csv = 'frame,side,x,y\n';
        
        if ((side === 'left' || side === 'both') && trajectoryData.leftTrajectory) {
            trajectoryData.leftTrajectory.forEach(point => {
                csv += `${point.frame},left,${point.x.toFixed(2)},${point.y.toFixed(2)}\n`;
            });
        }
        
        if ((side === 'right' || side === 'both') && trajectoryData.rightTrajectory) {
            trajectoryData.rightTrajectory.forEach(point => {
                csv += `${point.frame},right,${point.x.toFixed(2)},${point.y.toFixed(2)}\n`;
            });
        }
        
        const filename = this.generateFilename(`${this.baseFilename}_trajectories`, 'csv');
        this.downloadCSV(csv, filename);
    }
    
    /**
     * Export activity data as JSON
     * @param {Object} activityData - Activity data from ActivityAnalyzer
     * @param {Object} videoInfo - Video information
     * @param {string} metric - Current activity metric
     * @param {string} side - Which side to export
     */
    exportActivityJSON(activityData, videoInfo, metric, side = 'both') {
        const exportData = {
            video_info: {
                filename: this.videoFilename,
                fps: videoInfo.fps,
                total_frames: videoInfo.total_frames_processed
            },
            export_date: new Date().toISOString(),
            analysis_settings: {
                metric: metric,
                total_frames: activityData.totalFrames
            },
            data: {}
        };
        
        if (side === 'left' || side === 'both') {
            exportData.data.left = Array.from(activityData.leftActivityData);
            exportData.analysis_settings.max_left_activity = activityData.maxLeftActivity;
        }
        
        if (side === 'right' || side === 'both') {
            exportData.data.right = Array.from(activityData.rightActivityData);
            exportData.analysis_settings.max_right_activity = activityData.maxRightActivity;
        }
        
        const filename = this.generateFilename(`${this.baseFilename}_activity_analysis`, 'json');
        this.downloadJSON(exportData, filename);
    }
    
    /**
     * Export activity data as CSV
     * @param {Object} activityData - Activity data
     * @param {string} side - Which side to export
     */
    exportActivityCSV(activityData, side = 'both') {
        const totalFrames = activityData.totalFrames;
        let csv = 'frame';
        
        if (side === 'left' || side === 'both') csv += ',left_activity';
        if (side === 'right' || side === 'both') csv += ',right_activity';
        csv += '\n';
        
        for (let i = 0; i < totalFrames; i++) {
            csv += i;
            if (side === 'left' || side === 'both') {
                csv += `,${activityData.leftActivityData[i].toFixed(6)}`;
            }
            if (side === 'right' || side === 'both') {
                csv += `,${activityData.rightActivityData[i].toFixed(6)}`;
            }
            csv += '\n';
        }
        
        const filename = this.generateFilename(`${this.baseFilename}_activity_analysis`, 'csv');
        this.downloadCSV(csv, filename);
    }
    
    /**
     * Export proximity data as JSON
     * @param {Object} proximityData - Proximity data from ProximityAnalyzer
     * @param {Object} videoInfo - Video information
     * @param {string} side - Which side to export
     */
    exportProximityJSON(proximityData, videoInfo, side = 'both') {
        const exportData = {
            video_info: {
                filename: this.videoFilename,
                fps: videoInfo.fps,
                total_frames: videoInfo.total_frames_processed
            },
            export_date: new Date().toISOString(),
            analysis_settings: {
                metric: proximityData.metric,
                sensitivity: proximityData.sensitivity
            },
            data: {}
        };
        
        if (side === 'left' || side === 'both') {
            exportData.data.left = {
                mirror_proximity: Array.from(proximityData.leftProximityData),
                verticality: Array.from(proximityData.leftVerticalData)
            };
        }
        
        if (side === 'right' || side === 'both') {
            exportData.data.right = {
                mirror_proximity: Array.from(proximityData.rightProximityData),
                verticality: Array.from(proximityData.rightVerticalData)
            };
        }
        
        const filename = this.generateFilename(`${this.baseFilename}_proximity_analysis`, 'json');
        this.downloadJSON(exportData, filename);
    }
    
    /**
     * Export proximity data as CSV
     * @param {Object} proximityData - Proximity data
     * @param {string} side - Which side to export
     */
    exportProximityCSV(proximityData, side = 'both') {
        const totalFrames = proximityData.leftProximityData.length;
        let csv = 'frame';
        
        if (side === 'left' || side === 'both') {
            csv += ',left_mirror_proximity,left_verticality';
        }
        if (side === 'right' || side === 'both') {
            csv += ',right_mirror_proximity,right_verticality';
        }
        csv += '\n';
        
        for (let i = 0; i < totalFrames; i++) {
            csv += i;
            if (side === 'left' || side === 'both') {
                csv += `,${proximityData.leftProximityData[i].toFixed(6)},${proximityData.leftVerticalData[i].toFixed(6)}`;
            }
            if (side === 'right' || side === 'both') {
                csv += `,${proximityData.rightProximityData[i].toFixed(6)},${proximityData.rightVerticalData[i].toFixed(6)}`;
            }
            csv += '\n';
        }
        
        const filename = this.generateFilename(`${this.baseFilename}_proximity_analysis`, 'csv');
        this.downloadCSV(csv, filename);
    }
    
    /**
     * Export keyframes data as JSON
     * @param {Object} keyframesData - Raw keyframes data from the loaded file
     */
    exportKeyframesJSON(keyframesData) {
        if (!keyframesData) {
            console.error('No keyframes data available to export');
            return;
        }
        
        const exportData = {
            export_date: new Date().toISOString(),
            export_source: 'OctoWatch',
            ...keyframesData
        };
        
        const filename = this.generateFilename(`${this.baseFilename}_keyframes`, 'json');
        this.downloadJSON(exportData, filename);
    }
    
    /**
     * Export zone analysis data as JSON
     * @param {Object} zoneData - Zone data from ZoneAnalyzer
     * @param {Object} videoInfo - Video information
     */
    exportZoneAnalysisJSON(zoneData, videoInfo) {
        const exportData = {
            video_info: {
                filename: this.videoFilename,
                fps: videoInfo.fps,
                total_frames: videoInfo.total_frames_processed
            },
            export_date: new Date().toISOString(),
            zone_analysis: zoneData
        };
        
        const filename = this.generateFilename(`${this.baseFilename}_zone_analysis`, 'json');
        this.downloadJSON(exportData, filename);
    }
    
    /**
     * Export zone analysis data as CSV
     * @param {Object} zoneData - Zone data from ZoneAnalyzer
     * @param {Object} videoInfo - Video information
     */
    exportZoneAnalysisCSV(zoneData, videoInfo) {
        const fps = videoInfo.fps;
        let csv = 'frame,time_seconds,left_zones,right_zones\n';
        
        const totalFrames = zoneData.timeSeries.length;
        for (let i = 0; i < totalFrames; i++) {
            const frameData = zoneData.timeSeries[i];
            csv += `${frameData.frame},${frameData.time.toFixed(2)},${frameData.left_zones},${frameData.right_zones}\n`;
        }
        
        // Add summary section
        csv += '\n\nZone Occupancy Summary (%)\n';
        csv += 'Zone,Left Side,Right Side\n';
        
        const zones = ['D', 'MP', 'H1', 'H2', 'T', 'B'];
        zones.forEach(zone => {
            const leftPercent = zoneData.summary.left[zone].toFixed(1);
            const rightPercent = zoneData.summary.right[zone].toFixed(1);
            csv += `${zone},${leftPercent},${rightPercent}\n`;
        });
        
        const filename = this.generateFilename(`${this.baseFilename}_zone_analysis`, 'csv');
        this.downloadCSV(csv, filename);
    }
    
    /**
     * Export all data as combined JSON
     * @param {Object} allData - Object containing all analysis data
     * @param {string} side - Which side to export
     */
    exportAllJSON(allData, side = 'both') {
        const { heatmapData, trajectoryData, activityData, proximityData, videoInfo, keyframesData, zoneData } = allData;
        
        const exportData = {
            video_info: {
                filename: this.videoFilename,
                fps: videoInfo.fps,
                total_frames: videoInfo.total_frames_processed,
                width: videoInfo.width,
                height: videoInfo.height
            },
            export_date: new Date().toISOString(),
            side_selection: side,
            analysis_data: {}
        };
        
        // Add heatmap data
        if (heatmapData) {
            exportData.analysis_data.spatial_heatmap = {
                width: heatmapData.heatmapWidth,
                height: heatmapData.heatmapHeight
            };
            
            if (side === 'left' || side === 'both') {
                exportData.analysis_data.spatial_heatmap.left = {
                    data: Array.from(heatmapData.leftHeatmap),
                    max_value: heatmapData.leftMaxValue
                };
            }
            
            if (side === 'right' || side === 'both') {
                exportData.analysis_data.spatial_heatmap.right = {
                    data: Array.from(heatmapData.rightHeatmap),
                    max_value: heatmapData.rightMaxValue
                };
            }
        }
        
        // Add trajectory data
        if (trajectoryData && trajectoryData.trajectoryCalculated) {
            exportData.analysis_data.trajectories = {};
            
            if ((side === 'left' || side === 'both') && trajectoryData.leftTrajectory) {
                exportData.analysis_data.trajectories.left = trajectoryData.leftTrajectory.map(point => ({
                    frame: point.frame,
                    x: point.x,
                    y: point.y
                }));
            }
            
            if ((side === 'right' || side === 'both') && trajectoryData.rightTrajectory) {
                exportData.analysis_data.trajectories.right = trajectoryData.rightTrajectory.map(point => ({
                    frame: point.frame,
                    x: point.x,
                    y: point.y
                }));
            }
        }
        
        // Add activity data
        if (activityData) {
            exportData.analysis_data.activity = {
                metric: activityData.metric || 'centroid',
                total_frames: activityData.totalFrames
            };
            
            if (side === 'left' || side === 'both') {
                exportData.analysis_data.activity.left = {
                    max_activity: activityData.maxLeftActivity,
                    data: Array.from(activityData.leftActivityData)
                };
            }
            
            if (side === 'right' || side === 'both') {
                exportData.analysis_data.activity.right = {
                    max_activity: activityData.maxRightActivity,
                    data: Array.from(activityData.rightActivityData)
                };
            }
        }
        
        // Add proximity data
        if (proximityData) {
            exportData.analysis_data.proximity = {
                metric: proximityData.metric,
                sensitivity: proximityData.sensitivity
            };
            
            if (side === 'left' || side === 'both') {
                exportData.analysis_data.proximity.left = {
                    mirror_proximity: Array.from(proximityData.leftProximityData),
                    verticality: Array.from(proximityData.leftVerticalData)
                };
            }
            
            if (side === 'right' || side === 'both') {
                exportData.analysis_data.proximity.right = {
                    mirror_proximity: Array.from(proximityData.rightProximityData),
                    verticality: Array.from(proximityData.rightVerticalData)
                };
            }
        }
        
        // Add keyframes data
        if (keyframesData) {
            exportData.keyframes = keyframesData;
        }
        
        // Add zone analysis data
        if (zoneData) {
            exportData.analysis_data.zone_analysis = zoneData;
        }
        
        const filename = this.generateFilename(`${this.baseFilename}_all_analysis_data`, 'json');
        this.downloadJSON(exportData, filename);
    }
    
    /**
     * Download data as JSON file
     * @param {Object} data - Data to download
     * @param {string} filename - Filename
     */
    downloadJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        this.downloadBlob(blob, filename);
    }
    
    /**
     * Download data as CSV file
     * @param {string} csvContent - CSV content
     * @param {string} filename - Filename
     */
    downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv' });
        this.downloadBlob(blob, filename);
    }
    
    /**
     * Download blob as file
     * @param {Blob} blob - Blob to download
     * @param {string} filename - Filename
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}