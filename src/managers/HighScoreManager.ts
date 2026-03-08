export interface HighScoreEntry {
    name: string;
    score: number;
}

export class HighScoreManager {

    private storageKey = "dronewars_highscores";

    getScores(): HighScoreEntry[] {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
    }

    saveScore(name: string, score: number): void {

        const scores = this.getScores();

        scores.push({ name, score });

        scores.sort((a, b) => b.score - a.score);

        const topScores = scores.slice(0, 10);

        localStorage.setItem(this.storageKey, JSON.stringify(topScores));
    }
}