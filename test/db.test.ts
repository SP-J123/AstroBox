import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initDb } from '../src/server/db';

describe('db.ts', () => {
    let tempDir = '';
    let dbPath = '';

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-dnld-test-'));
        dbPath = path.join(tempDir, 'history.json');
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should initialize empty database', () => {
        const db = initDb(dbPath);
        expect(db.listHistory()).toEqual([]);
    });

    it('should save and retrieve a job', async () => {
        const db = initDb(dbPath);
        const job = {
            id: 'job-1',
            url: 'https://example.com/video',
            title: 'Test Video',
            status: 'completed',
            progress: 100,
            speed: '1MB/s',
            eta: '00:00',
            size: '10MB',
            format: 'best',
            startedAt: new Date().toISOString(),
            speedHistory: []
        };

        db.saveJob(job);
        await db.flush();

        const retrieved = db.getJob('job-1');
        expect(retrieved).toMatchObject({ id: 'job-1', title: 'Test Video' });

        // Test persistence
        const db2 = initDb(dbPath);
        expect(db2.getJob('job-1')).toMatchObject({ id: 'job-1', title: 'Test Video' });
    });

    it('should append logs correctly', async () => {
        const db = initDb(dbPath);
        db.saveJob({
            id: 'job-1', url: '', title: '', status: '', progress: 0, speed: '', eta: '', size: '', format: '', startedAt: '', speedHistory: []
        });
        db.appendLog('job-1', 'Log test 1');
        db.appendLog('job-1', 'Log test 2');

        expect(db.getLogs('job-1')).toEqual(['Log test 1', 'Log test 2']);
    });
});
