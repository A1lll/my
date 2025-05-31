// 三消游戏主类（优化音效播放延迟、结构清晰、含注释与调试信息）
// 请确保 js/sounds/ 目录下有 background.mp3、match.wav、error.wav
// LEVELS 配置请放在 js/levels.js

class Match3Game {
    soundEnabled = true; // 音效是否开启

    // 播放音效（优化延迟：重叠时clone，否则复用，预加载解码）
    playSound(type) {
        if (!this.soundEnabled) return;
        const sound = this.sounds[type];
        if (!sound) return;
        try {
            // 支持短音效重叠播放
            if (!sound.paused) {
                const clone = sound.cloneNode();
                clone.volume = sound.volume;
                clone.play();
            } else {
                sound.currentTime = 0;
                sound.play();
            }
        } catch (e) {
            // 可能因为用户未互动被拦截
            console.warn(`[Sound] 播放失败: ${e}`);
        }
        console.debug(`[Sound] Play: ${type}`);
    }

    constructor() {
        // 当前关卡索引
        this.currentLevel = 0;
        // 载入当前关卡配置
        this.levelConfig = LEVELS[this.currentLevel];
        this.rows = this.levelConfig.rows;
        this.cols = this.levelConfig.cols;
        this.colors = this.levelConfig.colors;

        this.score = 0;
        this.grid = [];
        this.isProcessing = false;
        this.gameGrid = document.getElementById("game-grid");

        // 载入音效
        this.sounds = {
            match: this.loadAudio('sfx-match', 'sounds/match.wav'),
            error: this.loadAudio('sfx-error', 'sounds/error.wav')
        };

        // 背景音乐
        this.bgm = new Audio('sounds/background.mp3');
        this.bgm.loop = true;
        this.bgm.volume = 0.5;
        this.bgm.preload = "auto";
        this.bgm.autoplay = true;

        // 解决首次用户交互前无法自动播放音效（自动解锁所有音频上下文）
        const unlockAudio = () => {
            // 预解锁所有音效
            Object.values(this.sounds).forEach(audio => {
                audio.muted = true;
                audio.play().catch(()=>{});
                audio.pause();
                audio.muted = false;
                audio.currentTime = 0;
            });
            // 预解锁背景音乐
            this.bgm.muted = true;
            this.bgm.play().catch(()=>{});
            this.bgm.pause();
            this.bgm.muted = false;
            this.bgm.currentTime = 0;
        };
        document.addEventListener('click', unlockAudio, { once: true });

        // 初始化
        this.init();
        this.addEventListeners();
        this.startTimer(this.levelConfig.timeLimit);
        this.initSoundToggle();

        window.addEventListener("resize", () => this.setGridLayout());
        console.debug("[Game] Match3Game 初始化完成");
    }

    // 初始化音效与背景音乐开关按钮
    initSoundToggle() {
        // 背景音乐按钮
        let bgmBtn = document.getElementById('bgm-toggle');
        if (!bgmBtn) {
            bgmBtn = document.createElement('button');
            bgmBtn.id = 'bgm-toggle';
            bgmBtn.textContent = '🎵 音乐开';
            bgmBtn.className = 'ui-btn';
            document.body.appendChild(bgmBtn);
        }
        bgmBtn.addEventListener('click', () => {
            if (this.bgm.paused) {
                this.bgm.play();
                bgmBtn.textContent = '🎵 音乐开';
            } else {
                this.bgm.pause();
                bgmBtn.textContent = '🔇 静音';
            }
            console.debug(`[BGM] 切换背景音乐: ${this.bgm.paused ? '关闭' : '开启'}`);
        });

        // 音效按钮
        let soundBtn = document.getElementById('sound-toggle');
        if (!soundBtn) {
            soundBtn = document.createElement('button');
            soundBtn.id = 'sound-toggle';
            soundBtn.textContent = '🔊 音效开';
            soundBtn.className = 'ui-btn';
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
            console.debug(`[Sound] 切换音效：${this.soundEnabled}`);
        });
    }

    // 加载音效文件（预加载、只创建一次audio标签）
    loadAudio(id, src) {
        let audio = document.getElementById(id);
        if (audio) return audio;
        audio = document.createElement('audio');
        audio.id = id;
        audio.src = src;
        audio.preload = "auto";
        audio.style.display = "none";
        document.body.appendChild(audio);
        return audio;
    }

    // 重置游戏到当前关卡初始状态
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

        // 调试：重置游戏
        console.debug(`[Game] 重置当前关卡: ${this.currentLevel + 1}`);
    };

    // 设置网格自适应布局
    setGridLayout() {
        const grid = this.gameGrid;
        const cols = this.cols;
        // 计算gap+padding总宽度
        const style = getComputedStyle(grid);
        const gap = parseFloat(style.gap) || 8;
        const pad = parseFloat(style.padding) || 8;
        const gridWidth = Math.min(window.innerWidth * 0.96, 600); // 与css一致
        // 每格宽度
        const cellWidth = (gridWidth - (cols - 1) * gap - 2 * pad) / cols;
        grid.style.gridTemplateColumns = `repeat(${cols}, ${cellWidth}px)`;
        console.debug(`[Layout] 设置网格布局: cellWidth=${cellWidth}px`);
    }

    // 初始化游戏网格
    init() {
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
        this.setGridLayout();
        console.debug("[Grid] 初始网格：", JSON.stringify(this.grid));
    }

    // 生成一个无三连的初始网格
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
            // 调试：生成失败，使用随机网格
            console.warn("[Grid] 随机网格生成失败，使用完全随机网格");
            return Array.from({ length: this.rows }, () =>
                Array.from({ length: this.cols }, () =>
                    Math.floor(Math.random() * this.colors) + 1
                )
            );
        }
        // 调试：生成有效网格
        console.debug(`[Grid] 成功生成网格, 尝试次数: ${attemptCount}`);
        return newGrid;
    }

    // 获取当前位置可用颜色，避免初始三连
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

    // 校验网格无三连
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

    // 生成一个随机宝石
    generateRandomGem() {
        return Math.floor(Math.random() * this.colors) + 1;
    }

    // 绑定事件监听
    addEventListeners() {
        if (this.eventBound) return;
        this.eventBound = true;
        let selectedCell = null;
        this.gameGrid.addEventListener("click", (e) => {
            if (this.isProcessing || !e.target.classList.contains("cell")) return;
            if (!selectedCell) {
                selectedCell = e.target;
                selectedCell.classList.add('selected');
            } else {
                const [r1, c1] = [parseInt(selectedCell.dataset.row), parseInt(selectedCell.dataset.col)];
                const [r2, c2] = [parseInt(e.target.dataset.row), parseInt(e.target.dataset.col)];
                if (this.isAdjacent(r1, c1, r2, c2)) {
                    this.swapGems(r1, c1, r2, c2);
                }
                selectedCell.classList.remove('selected');
                selectedCell = null;
            }
        });
        document.getElementById("restart").addEventListener("click", this.resetGame);
    }

    // 判断两个格子是否相邻
    isAdjacent(r1, c1, r2, c2) {
        return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
    }

    // 尝试交换两个宝石
    swapGems(r1, c1, r2, c2) {
        this.isProcessing = true;
        [this.grid[r1][c1], this.grid[r2][c2]] = [this.grid[r2][c2], this.grid[r1][c1]];
        const tempMatches = this.checkMatches(true);
        const isValidMove = tempMatches.size > 0;
        [this.grid[r1][c1], this.grid[r2][c2]] = [this.grid[r2][c2], this.grid[r1][c1]];
        console.debug(`[Swap] (${r1},${c1}) <-> (${r2},${c2}) 是否有效: ${isValidMove}`);
        if (!isValidMove) {
            this.playInvalidSwapAnimation(r1, c1, r2, c2);
            this.isProcessing = false;
            return;
        }
        this.executeValidSwap(r1, c1, r2, c2);
    }

    // 执行有效交换
    executeValidSwap(r1, c1, r2, c2) {
        [this.grid[r1][c1], this.grid[r2][c2]] = [this.grid[r2][c2], this.grid[r1][c1]];
        const cells = document.getElementsByClassName("cell");
        cells[r1 * this.cols + c1].style.backgroundImage =
            `url(images/gem${this.grid[r1][c1]}.png)`;
        cells[r2 * this.cols + c2].style.backgroundImage =
            `url(images/gem${this.grid[r2][c2]}.png)`;
        setTimeout(() => this.checkMatches(), 300);
    }

    // 播放非法交换抖动动画并提示
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
        console.debug(`[Swap] 无效交换: (${r1},${c1}) <-> (${r2},${c2})`);
    }

    // 检查所有消除，isPreview为true仅预览
    checkMatches(isPreview = false) {
        const matches = new Set();
        // 横向三连
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
        // 纵向三连
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
            // 调试：有消除
            console.debug(`[Match] 消除: ${Array.from(matches).join(' | ')}`);
            this.removeMatches([...matches]);
        } else {
            this.isProcessing = false;
            // 调试：无消除
            console.debug("[Match] 无消除");
        }
        return matches;
    }

    // 移除所有消除的格子
    removeMatches(matches) {
        if (matches.length >= 3) {
            this.playSound('match'); // 优先播放音效
        }
        matches.forEach(pos => {
            const [row, col] = pos.split(",").map(Number);
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) cell.style.opacity = '0';
            this.grid[row][col] = 0;
        });
        this.score += matches.length * 1;
        document.getElementById("score").textContent = this.score;
        console.debug(`[Score] 当前分数: ${this.score}`);
        // 过关条件分数可根据实际调整
        if (this.score >= 50) {
            this.handleLevelComplete();
            return;
        }
        setTimeout(() => {
            this.applyGravity();
        }, 300);
    }

    // 宝石下落补位
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

    // 填补新宝石
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

    // 开始计时
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

        // 调试：计时器启动
        console.debug(`[Timer] 计时开始: ${seconds}秒`);
    }

    // 关卡完成
    handleLevelComplete() {
        clearInterval(this.timerInterval);
        alert(`🎉 恭喜你通关第 ${this.currentLevel + 1} 关！`);
        this.currentLevel++;
        if (this.currentLevel >= LEVELS.length) {
            alert("你已经通关所有关卡！");
            console.debug("[Game] 全部关卡完成");
            return;
        }
        this.loadNextLevel();
    }

    // 关卡失败
    handleLevelFailed() {
        alert("⏰ 时间到，挑战失败！");
        console.debug(`[Game] 关卡失败: ${this.currentLevel + 1}`);
        this.resetGame();
    }

    // 加载下一关
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
        this.init();
        this.startTimer(this.levelConfig.timeLimit);
        console.debug(`[Game] 进入下一关: ${this.currentLevel + 1}`);
    }
}

// 实例化游戏
new Match3Game();