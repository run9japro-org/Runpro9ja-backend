// utils/passwordLogger.js
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// ES6 equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PasswordLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.logFile = path.join(this.logDir, 'admin-passwords.log');
    this.initializeLogger();
  }

  async initializeLogger() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      
      // Create log file if it doesn't exist
      try {
        await fs.access(this.logFile);
      } catch {
        await fs.writeFile(this.logFile, '');
      }
      
      console.log('📁 Password logger initialized at:', this.logFile);
    } catch (error) {
      console.error('❌ Failed to initialize password logger:', error);
    }
  }

  async logPasswordRotation(user, newPassword) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        user: {
          email: user.email,
          role: user.role,
          id: user._id.toString()
        },
        newPassword,
        system: {
          hostname: os.hostname(),
          platform: os.platform()
        }
      };

      const logLine = JSON.stringify(logEntry) + ',\n';
      
      await fs.appendFile(this.logFile, logLine);
      
      console.log('🔐 Password logged to:', this.logFile);
      console.log('🆕 New admin password:', newPassword);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to log password:', error);
      return false;
    }
  }

  async getRecentRotations(limit = 10) {
    try {
      const data = await fs.readFile(this.logFile, 'utf8');
      
      if (!data.trim()) {
        return [];
      }
      
      const lines = data.trim().split(',\n').filter(line => line.trim());
      const rotations = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          console.error('Failed to parse log line:', line);
          return null;
        }
      }).filter(Boolean).reverse().slice(0, limit);

      return rotations;
    } catch (error) {
      console.error('❌ Failed to read password log:', error);
      return [];
    }
  }

  async cleanupOldLogs(daysToKeep = 30) {
    try {
      const data = await fs.readFile(this.logFile, 'utf8');
      
      if (!data.trim()) {
        return;
      }
      
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      const lines = data.trim().split(',\n').filter(line => line.trim());
      
      const recentLines = lines.filter(line => {
        try {
          const entry = JSON.parse(line);
          return new Date(entry.timestamp) > new Date(cutoffTime);
        } catch (e) {
          return true; // Keep malformed lines
        }
      });

      await fs.writeFile(this.logFile, recentLines.join(',\n') + (recentLines.length ? ',\n' : ''));
      console.log(`🧹 Cleaned up password logs, kept ${recentLines.length} recent entries`);
    } catch (error) {
      console.error('❌ Failed to cleanup logs:', error);
    }
  }
}

// ✅ ES6 export - FIXED!
export default new PasswordLogger();