// DOM(HTML) 요소가 모두 로드된 후에 스크립트를 실행합니다.
document.addEventListener('DOMContentLoaded', () => {

    // HTML에서 필요한 요소들 가져오기
    const gameBoardElement = document.getElementById('game-board');
    const scoreElement = document.getElementById('score');
    const startButton = document.getElementById('start-button');
    // (추가) 홀드 박스 요소
    const holdBoxElement = document.getElementById('hold-box');

    // --- 1. 게임 기본 설정 ---
    const GRID_WIDTH = 10; // 게임판 가로
    const GRID_HEIGHT = 20; // 게임판 세로
    let gridCells = []; // HTML 격자(div) 요소들을 담을 배열
    let score = 0;
    let gameInterval; // 게임 루프(블록 자동 하강)를 위한 변수
    let isGameOver = false;
    
    // (추가) 홀드 기능용 변수
    let heldPiece = null;
    let hasSwapped = false;
    
    // (추가) 고스트 피스용 변수
    let lastGhostPosition = null;
    let lastGhostShapeData = null;

    // (추가) 홀드 박스 UI용 변수
    let holdBoxCells = [];
    const HOLD_GRID_SIZE = 4; // 홀드 박스는 4x4

    // 'gameBoard'는 2차원 배열로, 게임의 상태를 저장합니다.
    let gameBoardModel = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0));

    // --- 2. 테트로미노(블록) 정의 ---
    
    // prettier-ignore
    const PIECES = [
        {
            name: 'T', color: 'T',
            shapes: [ [ [0, 1, 0], [1, 1, 1], [0, 0, 0] ], [ [1, 0, 0], [1, 1, 0], [1, 0, 0] ], [ [0, 0, 0], [1, 1, 1], [0, 1, 0] ], [ [0, 1, 0], [0, 1, 1], [0, 1, 0] ] ]
        },
        {
            name: 'O', color: 'O',
            shapes: [ [ [1, 1], [1, 1] ] ]
        },
        {
            name: 'L', color: 'L',
            shapes: [ [ [0, 0, 1], [1, 1, 1], [0, 0, 0] ], [ [1, 0, 0], [1, 0, 0], [1, 1, 0] ], [ [0, 0, 0], [1, 1, 1], [1, 0, 0] ], [ [0, 1, 1], [0, 0, 1], [0, 0, 1] ] ]
        },
        {
            name: 'J', color: 'J',
            shapes: [ [ [1, 0, 0], [1, 1, 1], [0, 0, 0] ], [ [0, 1, 1], [0, 1, 0], [0, 1, 0] ], [ [0, 0, 0], [1, 1, 1], [0, 0, 1] ], [ [0, 1, 0], [0, 1, 0], [1, 1, 0] ] ]
        },
        {
            name: 'I', color: 'I',
            shapes: [ [ [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0] ], [ [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0] ] ]
        },
        {
            name: 'S', color: 'S',
            shapes: [ [ [0, 1, 1], [1, 1, 0], [0, 0, 0] ], [ [1, 0, 0], [1, 1, 0], [0, 1, 0] ] ]
        },
        {
            name: 'Z', color: 'Z',
            shapes: [ [ [1, 1, 0], [0, 1, 1], [0, 0, 0] ], [ [0, 1, 0], [1, 1, 0], [1, 0, 0] ] ]
        }
    ];

    // 현재 움직이는 블록의 정보
    let currentPiece;
    let currentPosition; // { x: 0, y: 0 } 형태
    let currentRotation;


    // --- 3. 게임 보드 생성 ---

    /**
     * 게임 보드(HTML)를 생성하고 gridCells 배열을 채웁니다.
     */
    function createBoard() {
        for (let i = 0; i < GRID_WIDTH * GRID_HEIGHT; i++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            gameBoardElement.appendChild(cell);
            gridCells.push(cell); 
        }
    }

    /**
     * (신규) 홀드 박스(HTML)를 생성하고 holdBoxCells 배열을 채웁니다.
     */
    function createHoldBox() {
        for (let i = 0; i < HOLD_GRID_SIZE * HOLD_GRID_SIZE; i++) {
            const cell = document.createElement('div');
            cell.classList.add('hold-cell');
            holdBoxElement.appendChild(cell);
            holdBoxCells.push(cell);
        }
    }

    // --- 4. 게임 핵심 로직 ---

    /**
     * (수정) 새로운 랜덤 조각을 생성하고 위치를 설정합니다.
     */
    function spawnPiece(pieceToSpawn = null) {
        let newPiece;
        if (pieceToSpawn) {
            newPiece = pieceToSpawn;
        } else {
            const randomIndex = Math.floor(Math.random() * PIECES.length);
            newPiece = PIECES[randomIndex];
        }
        
        currentPiece = {
            ...newPiece,
            shape: newPiece.shapes[0]
        };
        currentRotation = 0;
        currentPosition = { 
            x: Math.floor(GRID_WIDTH / 2) - 1,
            y: 0 
        };

        if (checkCollision(0, 0, currentPiece.shape)) {
            gameOver();
        } else {
            drawPiece();
            updateGhostPiece(); 
        }
    }

    /**
     * 현재 조각을 보드에 그립니다 (CSS 클래스 추가).
     */
    function drawPiece() {
        currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value === 1) {
                    const boardX = currentPosition.x + x;
                    const boardY = currentPosition.y + y;
                    if (boardY < GRID_HEIGHT && boardX < GRID_WIDTH) {
                        const cellIndex = boardY * GRID_WIDTH + boardX;
                        if (gridCells[cellIndex]) {
                            gridCells[cellIndex].classList.add(currentPiece.color);
                        }
                    }
                }
            });
        });
    }

    /**
     * 현재 조각을 보드에서 지웁니다 (CSS 클래스 제거).
     */
    function undrawPiece() {
        currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value === 1) {
                    const boardX = currentPosition.x + x;
                    const boardY = currentPosition.y + y;
                    if (boardY < GRID_HEIGHT && boardX < GRID_WIDTH) {
                        const cellIndex = boardY * GRID_WIDTH + boardX;
                        if (gridCells[cellIndex]) {
                            gridCells[cellIndex].classList.remove(currentPiece.color);
                        }
                    }
                }
            });
        });
    }

    /**
     * 충돌 검사
     */
    function checkCollision(xOffset, yOffset, shape) {
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x] === 1) {
                    let newX = currentPosition.x + x + xOffset;
                    let newY = currentPosition.y + y + yOffset;

                    if (newX < 0 || newX >= GRID_WIDTH || newY >= GRID_HEIGHT) {
                        return true; 
                    }
                    if (newY >= 0) {
                        if (gameBoardModel[newY][newX] !== 0) {
                            return true; 
                        }
                    }
                }
            }
        }
        return false; 
    }


    /**
     * (수정) 조각을 바닥이나 다른 조각 위에 고정시킵니다.
     */
    function lockPiece() {
        currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value === 1) {
                    const boardX = currentPosition.x + x;
                    const boardY = currentPosition.y + y;
                    if (boardY >= 0) {
                        gameBoardModel[boardY][boardX] = currentPiece.color;
                    }
                }
            });
        });
        
        updateBoardView();
        checkLines();
        hasSwapped = false; // (수정) 스왑 플래그 리셋
        spawnPiece();
    }
    
    /**
     * 완성된 줄이 있는지 검사하고 제거합니다.
     */
    function checkLines() {
        let linesCleared = 0;
        for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
            const isLineFull = gameBoardModel[y].every(cell => cell !== 0);
            if (isLineFull) {
                linesCleared++;
                gameBoardModel.splice(y, 1);
                gameBoardModel.unshift(Array(GRID_WIDTH).fill(0));
                y++; 
            }
        }
        
        // 점수 계산... (기존과 동일)
        switch (linesCleared) {
            case 1: score += 10; break;
            case 2: score += 30; break;
            case 3: score += 50; break;
            case 4: score += 100; break;
        }
        scoreElement.textContent = score;
        
        if (linesCleared > 0) {
            updateBoardView();
        }
    }

    /**
     * gameBoardModel(데이터)을 기반으로 HTML 뷰(화면)를 업데이트합니다.
     */
    function updateBoardView() {
        // (수정) 고스트 피스 지우기
        if (lastGhostPosition && lastGhostShapeData) {
            lastGhostShapeData.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value === 1) {
                        const cellIndex = (lastGhostPosition.y + y) * GRID_WIDTH + (lastGhostPosition.x + x);
                        if (gridCells[cellIndex]) {
                            gridCells[cellIndex].classList.remove('ghost');
                        }
                    }
                });
            });
        }
        lastGhostPosition = null;
        lastGhostShapeData = null;

        // 메인 보드 업데이트 (기존과 동일)
        gameBoardModel.forEach((row, y) => {
            row.forEach((cellValue, x) => {
                const cellIndex = y * GRID_WIDTH + x;
                const cell = gridCells[cellIndex];
                cell.classList.remove('T', 'O', 'L', 'J', 'I', 'S', 'Z', 'locked', 'ghost');
                if (cellValue !== 0) {
                    cell.classList.add(cellValue);
                    cell.classList.add('locked'); 
                }
            });
        });
    }

    /**
     * (신규) 홀드 박스(HTML)의 뷰를 업데이트합니다.
     */
    function updateHoldView(piece) {
        // 1. 홀드 박스 초기화
        holdBoxCells.forEach(cell => {
            cell.classList.remove('T', 'O', 'L', 'J', 'I', 'S', 'Z');
        });

        if (piece) {
            // 2. 조각의 기본 모양(첫 번째 회전)을 가져옴
            const shape = piece.shapes[0];
            
            // 3. (선택) 조각을 4x4 중앙에 배치하기 위한 오프셋
            let xOffset = 0;
            let yOffset = 0;
            if (piece.name === 'I') yOffset = -1; // I 조각
            else if (piece.name === 'O') xOffset = 1; // O 조각
            else yOffset = 1; // 3x3 조각들

            // 4. 홀드 박스에 조각 그리기
            shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value === 1) {
                        const cellX = x + xOffset;
                        const cellY = y + yOffset;
                        
                        if (cellX >= 0 && cellX < HOLD_GRID_SIZE && cellY >= 0 && cellY < HOLD_GRID_SIZE) {
                           const cellIndex = cellY * HOLD_GRID_SIZE + cellX;
                            if (holdBoxCells[cellIndex]) {
                                holdBoxCells[cellIndex].classList.add(piece.color);
                            }
                        }
                    }
                });
            });
        }
    }


    // --- 5. 블록 이동 함수 ---

    /**
     * (수정) 블록을 한 칸 아래로 내립니다 (자동 하강).
     */
    function moveDown() {
        if (isGameOver) return;
        if (!checkCollision(0, 1, currentPiece.shape)) {
            undrawPiece(); 
            currentPosition.y++; 
            drawPiece(); 
            updateGhostPiece(); 
        } else {
            lockPiece(); 
        }
    }
    
    /**
     * (수정) 블록을 왼쪽으로 이동
     */
    function moveLeft() {
        if (isGameOver) return;
        if (!checkCollision(-1, 0, currentPiece.shape)) {
            undrawPiece();
            currentPosition.x--;
            drawPiece();
            updateGhostPiece(); 
        }
    }

    /**
     * (수정) 블록을 오른쪽으로 이동
     */
    function moveRight() {
        if (isGameOver) return;
        if (!checkCollision(1, 0, currentPiece.shape)) {
            undrawPiece();
            currentPosition.x++;
            drawPiece();
            updateGhostPiece();
        }
    }
    
    /**
     * (교체) 블록을 회전 (월 킥 기능 포함)
     */
    function rotate() {
        if (isGameOver) return;
        undrawPiece();
        
        const nextRotationIndex = (currentRotation + 1) % currentPiece.shapes.length;
        const rotatedShape = currentPiece.shapes[nextRotationIndex];
        
        const kickOffsets = [ [0, 0], [-1, 0], [1, 0] ];
        if (currentPiece.name === 'I') {
            kickOffsets.push([-2, 0]);
            kickOffsets.push([2, 0]);
        }

        for (const [xOffset, yOffset] of kickOffsets) { 
            if (!checkCollision(xOffset, yOffset, rotatedShape)) {
                currentRotation = nextRotationIndex;
                currentPiece.shape = rotatedShape;
                currentPosition.x += xOffset;
                currentPosition.y += yOffset;
                break; 
            }
        }
        
        drawPiece();
        updateGhostPiece();
    }

    /**
     * (기존) 블록을 즉시 바닥으로 내리고 고정시킵니다 (하드 드롭).
     */
    function hardDrop() {
        if (isGameOver) return;

        undrawPiece(); // 1. 현재 위치 지우기

        // 2. 충돌할 때까지 y를 계속 증가시킴 (yOffset 계산)
        let yOffset = 1;
        while (!checkCollision(0, yOffset, currentPiece.shape)) {
            yOffset++;
        }
        
        // 3. 충돌 직전(yOffset - 1) 위치로 y좌표 업데이트
        currentPosition.y += (yOffset - 1);
        
        drawPiece(); // 4. 최종 위치에 다시 그리기
        lockPiece(); // 5. 바로 고정
    }

    /**
     * (수정) C 키를 눌러 조각을 홀드(저장)합니다.
     */
    function holdPiece() {
        if (isGameOver || hasSwapped) return; 

        undrawPiece(); 
        
        // PIECES 배열에서 현재 조각의 원본(이름 기준)을 찾음
        const currentPieceBase = PIECES.find(p => p.name === currentPiece.name);

        if (heldPiece === null) {
            // 1. 홀드된 조각이 없으면, 현재 조각을 홀드하고 새 조각 스폰
            heldPiece = currentPieceBase;
            spawnPiece();
        } else {
            // 2. 홀드된 조각이 있으면, 현재 조각과 스왑
            const pieceToSpawn = heldPiece; 
            heldPiece = currentPieceBase;
            spawnPiece(pieceToSpawn); // 홀드했던 조각 스폰
        }

        hasSwapped = true; // 이번 턴에는 더 이상 스왑 불가
        updateHoldView(heldPiece); // (추가) 홀드 UI 업데이트
    }

    /**
     * (기존) 고스트 조각을 지우고, 계산하고, 새로 그립니다.
     */
    function updateGhostPiece() {
        if (isGameOver) return;

        // 1. 이전 고스트 지우기
        if (lastGhostPosition && lastGhostShapeData) {
            lastGhostShapeData.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value === 1) {
                        const boardX = lastGhostPosition.x + x;
                        const boardY = lastGhostPosition.y + y;
                        if (boardY < GRID_HEIGHT && boardX < GRID_WIDTH) {
                            const cellIndex = boardY * GRID_WIDTH + boardX;
                            if (gridCells[cellIndex] && !gridCells[cellIndex].classList.contains(currentPiece.color)) {
                                 gridCells[cellIndex].classList.remove('ghost');
                            }
                        }
                    }
                });
            });
        }

        // 2. 새 고스트 위치 계산
        const shape = currentPiece.shape;
        let yOffset = 1;
        while (!checkCollision(0, yOffset, shape)) {
            yOffset++;
        }
        let ghostY = currentPosition.y + (yOffset - 1);

        // 3. 새 고스트 정보 저장
        lastGhostPosition = { x: currentPosition.x, y: ghostY };
        lastGhostShapeData = shape;

        // 4. 새 고스트 그리기
        if (lastGhostPosition.y === currentPosition.y) return; 

        lastGhostShapeData.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value === 1) {
                    const boardX = lastGhostPosition.x + x;
                    const boardY = lastGhostPosition.y + y;
                    if (boardY < GRID_HEIGHT && boardX < GRID_WIDTH) {
                        const cellIndex = boardY * GRID_WIDTH + boardX;
                        if (gridCells[cellIndex] && !gridCells[cellIndex].classList.contains('locked')) {
                            gridCells[cellIndex].classList.add('ghost');
                        }
                    }
                }
            });
        });
    }


    // --- 6. 게임 제어 ---

    /**
     * (기존) 키보드 입력 처리
     */
    function control(e) {
        if (isGameOver) return;
        
        switch (e.key) {
            case 'ArrowLeft': moveLeft(); break;
            case 'ArrowRight': moveRight(); break;
            case 'ArrowDown': moveDown(); break;
            case 'ArrowUp': rotate(); break;
            case ' ': hardDrop(); break; // 스페이스 바
            case 'c': // C 키
            case 'C': holdPiece(); break;
        }
    }

    /**
     * 게임 오버 처리
     */
    function gameOver() {
        isGameOver = true;
        clearInterval(gameInterval);
        alert(`게임 오버! 최종 점수: ${score}`);
    }

    /**
     * (수정) 게임 시작/재시작
     */
    function startGame() {
        isGameOver = false;
        score = 0;
        scoreElement.textContent = score;
        
        // (추가) 홀드 초기화
        heldPiece = null;
        hasSwapped = false;
        updateHoldView(null); // (추가) 홀드 UI 클리어
        
        gameBoardModel = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0));
        updateBoardView(); // 뷰 초기화
        
        if (gameInterval) {
            clearInterval(gameInterval);
        }

        spawnPiece();
        gameInterval = setInterval(moveDown, 1000);
    }


    // --- 7. 이벤트 리스너 연결 ---
    
    createBoard();
    createHoldBox(); // (추가) 홀드 박스 생성
    document.addEventListener('keydown', control);
    startButton.addEventListener('click', startGame);

});