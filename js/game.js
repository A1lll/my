// game.js
// 三消游戏主逻辑，支持多关卡、不同尺寸，进入下一关无空白、可正常操作

class Match3Game {
    soundEnabled = true; // 音效开关，默认开启

    playSound(type) {
        if (!this.soundEnabled) {
            console.log(`[Sound] 已静音，跳过音效: ${type}`);
            return;
        }
        const sound = this.sounds[type];
        if (!sound) {
            console.error(`Sound ${type} not loaded!`);
            return;
        }
        const clonedSound = sound.cloneNode();
        clonedSound.play();
    }

    constructor() {
        this.currentLevel = 0;
        this.levelConfig = LEVELS[this.currentLevel];
        this.rows = this.levelConfig.rows;
        this.cols = this.levelConfig.cols;
        this.colors = this.levelConfig.colors;

        this.score = 0;
        this.grid = [];
        this.isProcessing = false;
        this.gameGrid = document.getElementById("game-grid");

        this.init();
        this.addEventListeners();
        this.startTimer(this.levelConfig.timeLimit);

        this.sounds = {
            match: this.loadAudio('sfx-match', 'sounds/match.wav'),
            error: this.loadAudio('sfx-error', 'sounds/error.wav')
        };
        this.initSoundToggle();

        // 移动端音频解锁
        const unlockAudio = () => {
            Object.values(this.sounds).forEach(audio => {
                audio.muted = true;
                audio.play().catch(()=>{});
                audio.pause();
                audio.muted = false;
                audio.currentTime = 0;
            });
        };
        document.addEventListener('click', unlockAudio, { once: true });
    }

    initSoundToggle() {
        let soundBtn = document.getElementById('sound-toggle');
        if (!soundBtn) {
            soundBtn = document.createElement('button');
            soundBtn.id = 'sound-toggle';
            soundBtn.textContent = '🔊 音效开';
            soundBtn.style.marginLeft = '10px';
            const scoreElem = document.getElementById('score');
            if (scoreElem && scoreElem.parentNode) {
                scoreElem.parentNode.insertBefore(soundBtn, scoreElem.nextSibling);
            } else {
                document.body.appendChild(soundBtn);
            }
        }
        soundBtn.addEventListener('click', () => {
            this.soundEnabled = !this.soundEnabled;
            soundBtn.textContent = this.soundEnabled ? '🔊 音效开' : '🔇 静音';
        });
    }

    loadAudio(id, src) {
        let audio = document.getElementById(id);
        if (audio) return audio;
        audio = document.createElement('audio');
        audio.id = id;
        audio.src = src;
        audio.preload = "auto";
        audio.style.display = "none";
        document.body.appendChild(audio);
        audio.onerror = () => {
            console.error(`[Sound] 加载失败: ${src}，请检查路径和格式`);
        };
        return audio;
    }

    resetGame = () => {
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.score = 0;
        document.getElementById("score").textContent = 0;
        this.gameGrid.innerHTML = "";
        this.grid = [];
        this.init();
        const cells = document.getElementsByClassName('cell');
        Array.from(cells).forEach(cell => {
            cell.style.opacity = '1';
        });
        this.startTimer(this.levelConfig.timeLimit);
    };

    init() {
        this.gameGrid.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
        this.gameGrid.innerHTML = "";
        this.grid = this.generateValidGrid();
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                const cell = document.createElement("div");
                cell.className = "cell";
                cell.dataset.row = i;
                cell.dataset.col = j;
                cell.style.backgroundImage = `url(images/gem${this.grid[i][j]}.png)`;
                this.gameGrid.appendChild(cell);
            }
        }
    }

    generateValidGrid() {
        let isValid = false;
        let attemptCount = 0;
        let newGrid;
        while (!isValid && attemptCount < 100) {
            attemptCount++;
            newGrid = [];
            for (let i = 0; i < this.rows; i++) {
                newGrid[i] = [];
                for (let j = 0; j < this.cols; j++) {
                    const availableColors = this.getAvailableColors(newGrid, i, j);
                    newGrid[i][j] = availableColors[
                        Math.floor(Math.random() * availableColors.length)
                    ];
                }
            }
            isValid = this.validateGrid(newGrid);
        }
        if (!isValid) {
            // 兜底，随机填满
            return Array.from({ length: this.rows }, () =>
                Array.from({ length: this.cols }, () =>
                    Math.floor(Math.random() * this.colors) + 1
                )
            );
        }
        return newGrid;
    }

    getAvailableColors(grid, row, col) {
        const colors = Array.from({ length: this.colors }, (_, i) => i + 1);
        if (col >= 2) {
            const prev1 = grid[row][col - 1];
            const prev2 = grid[row][col - 2];
            if (prev1 === prev2) {
                colors.splice(colors.indexOf(prev1), 1);
            }
        }
        if (row >= 2) {
            const prev1 = grid[row - 1][col];
            const prev2 = grid[row - 2][col];
            if (prev1 === prev2) {
                colors.splice(colors.indexOf(prev1), 1);
            }
        }
        return colors.length > 0 ? colors : Array.from({ length: this.colors }, (_, i) => i + 1);
    }

    validateGrid(grid) {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols - 2; j++) {
                if (grid[i][j] === grid[i][j + 1] && grid[i][j] === grid[i][j + 2]) return false;
            }
        }
        for (let j = 0; j < this.cols; j++) {
            for (let i = 0; i < this.rows - 2; i++) {
                if (grid[i][j] === grid[i + 1][j] && grid[i][j] === grid[i + 2][j]) return false;
            }
        }
        return true;
    }

    generateRandomGem() {
        return Math.floor(Math.random() * this.colors) + 1;
    }

    addEventListeners() {
        if (this.eventBound) return;
        this.eventBound = true;
        let selectedCell = null;
        this.gameGrid.addEventListener("click", (e) => {
            if (this.isProcessing || !e.target.classList.contains("cell")) return;
            if (!selectedCell) {
                selectedCell = e.target;
                selectedCell.style.transform = "scale(1.1)";
            } else {
                const [r1, c1] = [parseInt(selectedCell.dataset.row), parseInt(selectedCell.dataset.col)];
                const [r2, c2] = [parseInt(e.target.dataset.row), parseInt(e.target.dataset.col)];
                if (this.isAdjacent(r1, c1, r2, c2)) {
                    this.swapGems(r1, c1, r2, c2);
                }
                selectedCell.style.transform = "";
                selectedCell = null;
            }
        });
        document.getElementById("restart").addEventListener("click", this.resetGame);
    }

    isAdjacent(r1, c1, r2, c2) {
        return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
    }

    swapGems(r1, c1, r2, c2) {
        this.isProcessing = true;
        [this.grid[r1][c1], this.grid[r2][c2]] = [this.grid[r2][c2], this.grid[r1][c1]];
        const tempMatches = this.checkMatches(true);
        const isValidMove = tempMatches.size > 0;
        [this.grid[r1][c1], this.grid[r2][c2]] = [this.grid[r2][c2], this.grid[r1][c1]];
        if (!isValidMove) {
            this.playInvalidSwapAnimation(r1, c1, r2, c2);
            this.isProcessing = false;
            return;
        }
        this.executeValidSwap(r1, c1, r2, c2);
    }

    executeValidSwap(r1, c1, r2, c2) {
        [this.grid[r1][c1], this.grid[r2][c2]] = [this.grid[r2][c2], this.grid[r1][c1]];
        const cells = document.getElementsByClassName("cell");
        cells[r1 * this.cols + c1].style.backgroundImage =
            `url(images/gem${this.grid[r1][c1]}.png)`;
        cells[r2 * this.cols + c2].style.backgroundImage =
            `url(images/gem${this.grid[r2][c2]}.png)`;
        setTimeout(() => this.checkMatches(), 300);
    }

    playInvalidSwapAnimation(r1, c1, r2, c2) {
        this.playSound('error');
        const cells = document.getElementsByClassName("cell");
        const cell1 = cells[r1 * this.cols + c1];
        const cell2 = cells[r2 * this.cols + c2];
        cell1.classList.add("invalid-shake");
        cell2.classList.add("invalid-shake");
        setTimeout(() => {
            cell1.classList.remove("invalid-shake");
            cell2.classList.remove("invalid-shake");
            this.isProcessing = false;
        }, 500);
    }

    checkMatches(isPreview = false) {
        const matches = new Set();
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols - 2; col++) {
                if (this.grid[row][col] !== 0 &&
                    this.grid[row][col] === this.grid[row][col + 1] &&
                    this.grid[row][col] === this.grid[row][col + 2]) {
                    let ptr = col;
                    while (ptr < this.cols && this.grid[row][col] === this.grid[row][ptr]) {
                        matches.add(`${row},${ptr}`);
                        ptr++;
                    }
                }
            }
        }
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows - 2; row++) {
                if (this.grid[row][col] !== 0 &&
                    this.grid[row][col] === this.grid[row + 1][col] &&
                    this.grid[row][col] === this.grid[row + 2][col]) {
                    let ptr = row;
                    while (ptr < this.rows && this.grid[row][col] === this.grid[ptr][col]) {
                        matches.add(`${ptr},${col}`);
                        ptr++;
                    }
                }
            }
        }
        if (isPreview) return matches;
        if (matches.size > 0) {
            this.removeMatches([...matches]);
        } else {
            this.isProcessing = false;
        }
        return matches;
    }

    removeMatches(matches) {
        if (matches.length >= 3) {
            this.playSound('match');
        }
        matches.forEach(pos => {
            const [row, col] = pos.split(",").map(Number);
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) cell.style.opacity = '0';
            this.grid[row][col] = 0;
        });
        this.score += matches.length * 1;
        document.getElementById("score").textContent = this.score;

        if (this.score >= 50) {
            this.handleLevelComplete();
            return;
        }

        setTimeout(() => {
            this.applyGravity();
        }, 300);
    }

    applyGravity() {
        let moved = false;
        const cells = document.getElementsByClassName("cell");
        for (let col = 0; col < this.cols; col++) {
            let writePointer = this.rows - 1;
            for (let row = this.rows - 1; row >= 0; row--) {
                const current = this.grid[row][col];
                if (current !== 0) {
                    if (row !== writePointer) {
                        this.grid[writePointer][col] = current;
                        this.grid[row][col] = 0;
                        const targetIndex = writePointer * this.cols + col;
                        const sourceIndex = row * this.cols + col;
                        cells[targetIndex].style.backgroundImage = cells[sourceIndex].style.backgroundImage;
                        cells[targetIndex].style.opacity = '1';
                        cells[sourceIndex].style.backgroundImage = "";
                        moved = true;
                    }
                    writePointer--;
                }
            }
        }
        if (moved) {
            setTimeout(() => this.applyGravity(), 300);
        } else {
            this.fillEmptyCells();
        }
    }

    fillEmptyCells() {
        const cells = document.getElementsByClassName("cell");
        let filled = 0;
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                if (this.grid[row][col] === 0) {
                    const gem = this.generateRandomGem();
                    this.grid[row][col] = gem;
                    const index = row * this.cols + col;
                    cells[index].style.backgroundImage = `url(images/gem${gem}.png)`;
                    cells[index].style.opacity = '1';
                    cells[index].classList.add("new-gem");
                    setTimeout(() => cells[index].classList.remove("new-gem"), 300);
                    filled++;
                }
            }
        }
        if (filled > 0) {
            setTimeout(() => this.checkMatches(), 500);
        } else {
            this.isProcessing = false;
        }
    }

    startTimer(seconds) {
        this.remainingTime = seconds;
        let timerElement = document.getElementById("timer");
        if (!timerElement) {
            timerElement = document.createElement("div");
            timerElement.id = "timer";
            timerElement.style.margin = "10px";
            document.body.insertBefore(timerElement, this.gameGrid);
        }
        timerElement.textContent = `剩余时间: ${this.remainingTime}秒`;

        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.remainingTime--;
            timerElement.textContent = `剩余时间: ${this.remainingTime}秒`;
            if (this.remainingTime <= 0) {
                clearInterval(this.timerInterval);
                this.handleLevelFailed();
            }
        }, 1000);
    }

    handleLevelComplete() {
        clearInterval(this.timerInterval);
        alert(`🎉 恭喜你通关第 ${this.currentLevel + 1} 关！`);

        this.currentLevel++;
        if (this.currentLevel >= LEVELS.length) {
            alert("你已经通关所有关卡！");
            return;
        }
        this.loadNextLevel();
    }

    handleLevelFailed() {
        alert("⏰ 时间到，挑战失败！");
        this.resetGame();
    }

    loadNextLevel() {
        this.levelConfig = LEVELS[this.currentLevel];
        this.rows = this.levelConfig.rows;
        this.cols = this.levelConfig.cols;
        this.colors = this.levelConfig.colors;
        this.score = 0;

        document.getElementById("score").textContent = 0;
        this.gameGrid.innerHTML = "";
        this.grid = [];
        this.isProcessing = false;

        this.init();  // 只需要重新init，不要fillEmptyCells
        this.startTimer(this.levelConfig.timeLimit);
    }
}

new Match3Game();