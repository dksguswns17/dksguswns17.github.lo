// DOM(HTML) 요소가 모두 로드된 후에 스크립트를 실행합니다.
document.addEventListener('DOMContentLoaded', () => {

    // HTML에서 필요한 요소들 가져오기
    const gameBoardElement = document.getElementById('game-board');
    const scoreElement = document.getElementById('score');
    const startButton = document.getElementById('start-button');

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

    // 'gameBoard'는 2차원 배열로, 게임의 상태를 저장합니다.
    let gameBoardModel = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0));

    // --- 2. 테트로미노(블록) 정의 ---
    
    // prettier-ignore
    const PIECES = [
        {
            name: 'T',
            color: 'T', // CSS 클래스 이름
            shapes: [
                [ [0, 1, 0], [1, 1, 1], [0, 0, 0] ], // 1번 회전
                [ [1, 0, 0], [1, 1, 0], [1, 0, 0] ], // 2번 회전
                [ [0, 0, 0], [1, 1, 1], [0, 1, 0] ], // 3번 회전
                [ [0, 1, 0], [0, 1, 1], [0, 1, 0] ]  // 4번 회전
            ]
        },
        {
            name: 'O',
            color: 'O',
            shapes: [
                [ [1, 1], [1, 1] ] // O는 회전해도 모양이 같음
            ]
        },
        {
            name: 'L',
            color: 'L',
            shapes: [
                [ [0, 0, 1], [1, 1, 1], [0, 0, 0] ],
                [ [1, 0, 0], [1, 0, 0], [1, 1, 0] ],
                [ [0, 0, 0], [1, 1, 1], [1, 0, 0] ],
                [ [0, 1, 1], [0, 0, 1], [0, 0, 1] ]
            ]
        },
        {
            name: 'J',
            color: 'J',
            shapes: [
                [ [1, 0, 0], [1, 1, 1], [0, 0, 0] ],
                [ [0, 1, 1], [0, 1, 0], [0, 1, 0] ],
                [ [0, 0, 0], [1, 1, 1], [0, 0, 1] ],
                [ [0, 1, 0], [0, 1, 0], [1, 1, 0] ]
            ]
        },
        {
            name: 'I',
            color: 'I',
            shapes: [
                [ [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0] ],
                [ [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0] ]
            ]
        },
        {
            name: 'S',
            color: 'S',
            shapes: [
                [ [0, 1, 1], [1, 1, 0], [0, 0, 0] ],
                [ [1, 0, 0], [1, 1, 0], [0, 1, 0] ]
            ]
        },
        {
            name: 'Z',
            color: 'Z',
            shapes: [
                [ [1, 1, 0], [0, 1, 1], [0, 0, 0] ],
                [ [0, 1, 0], [1, 1, 0], [1, 0, 0] ]
            ]
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

    // --- 4. 게임 핵심 로직 ---

    /**
     * (수정) 새로운 랜덤 조각을 생성하고 위치를 설정합니다.
     * (pieceToSpawn이 주어지면 해당 조각을 스폰합니다)
     */
    function spawnPiece(pieceToSpawn = null) {
        let newPiece;
        if (pieceToSpawn) {
            newPiece = pieceToSpawn;
        } else {
            // 0부터 PIECES 배열 길이 사이의 랜덤 숫자
            const randomIndex = Math.floor(Math.random() * PIECES.length);
            newPiece = PIECES[randomIndex];
        }
        
        currentPiece = {
            ...newPiece, // 이름, 색상, 모양 배열 복사
            shape: newPiece.shapes[0] // 현재 모양은 첫 번째 회전 상태
        };
        
        currentRotation = 0;
        
        // 시작 위치 (상단 중앙)
        currentPosition = { 
            x: Math.floor(GRID_WIDTH / 2) - 1, // 중앙 정렬
            y: 0 
        };

        // 스폰되자마자 충돌하면 (쌓인 블록이 맨 위까지 찼으면) 게임 오버
        if (checkCollision(0, 0, currentPiece.shape)) {
            gameOver();
        } else {
            drawPiece(); // 충돌하지 않으면 블록을 그립니다.
            updateGhostPiece(); // (추가) 고스트 피스 업데이트
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
     * 충돌 검사 (가장 중요!)
     */
    function checkCollision(xOffset, yOffset, shape) {
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                
                if (shape[y][x] === 1) {
                    
                    let newX = currentPosition.x + x + xOffset;
                    let newY = currentPosition.y + y + yOffset;

                    // 1. 벽(좌, 우, 바닥)에 충돌하는가?
                    if (newX < 0 || newX >= GRID_WIDTH || newY >= GRID_HEIGHT) {
                        return true; 
                    }
                    
                    // 2. 다른 'locked'된 블록과 충돌하는가?
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

        // (추가) 스왑 플래그 리셋
        hasSwapped = false;

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
        
        switch (linesCleared) {
            case 1:
                score += 10;
                break;
            case 2:
                score += 30;
                break;
            case 3:
                score += 50;
                break;
            case 4: 
                score += 100;
                break;
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
        // (추가) 고스트 피스 지우기 (보드 전체 업데이트 전)
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
        lastGhostPosition = null; // 고스트 정보 초기화
        lastGhostShapeData = null;

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
            updateGhostPiece(); // (추가) 고스트 피스 업데이트
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
            updateGhostPiece(); // (추가) 고스트 피스 업데이트
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
            updateGhostPiece(); // (추가) 고스트 피스 업데이트
        }
    }
    
    /**
     * (교체) 블록을 회전 (시계 방향)
     * (간단한 월 킥 기능 포함)
     */
    function rotate() {
        if (isGameOver) return;
        
        undrawPiece(); // 일단 현재 모양 지우기
        
        // 다음 회전 인덱스 계산
        const nextRotationIndex = (currentRotation + 1) % currentPiece.shapes.length;
        const rotatedShape = currentPiece.shapes[nextRotationIndex];
        
        // 시도할 '킥' (이동) 오프셋 배열
        const kickOffsets = [
            [0, 0],   // 1. 제자리
            [-1, 0],  // 2. 왼쪽 1칸
            [1, 0],   // 3. 오른쪽 1칸
        ];

        if (currentPiece.name === 'I') {
            kickOffsets.push([-2, 0]);
            kickOffsets.push([2, 0]);
        }

        let rotationSuccess = false;

        for (const [xOffset, yOffset] of kickOffsets) { 
            
            if (!checkCollision(xOffset, yOffset, rotatedShape)) {
                // 충돌 안 하면 회전 및 킥(이동) 적용
                currentRotation = nextRotationIndex;
                currentPiece.shape = rotatedShape;
                currentPosition.x += xOffset;
                currentPosition.y += yOffset;
                
                rotationSuccess = true;
                break; // 성공했으므로 'for' 루프 중단
            }
        }
        
        drawPiece(); // (회전했든 안했든) 현재 위치에 다시 그리기
        
        // (추가) 고스트 조각도 업데이트
        updateGhostPiece();
    }

    /**
     * (신규) 블록을 즉시 바닥으로 내리고 고정시킵니다 (하드 드롭).
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
        
        // 4. 최종 위치에 다시 그리기 (시각적 효과)
        drawPiece(); 
        
        // 5. 바로 고정
        lockPiece();
    }

    /**
     * (신규) C 키를 눌러 조각을 홀드(저장)합니다.
     */
    function holdPiece() {
        if (isGameOver || hasSwapped) return; // 게임오버거나 이미 스왑했으면 무시

        undrawPiece(); // 현재 조각 지우기
        
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
    }

    /**
     * (신규) 고스트 조각을 지우고, 계산하고, 새로 그립니다.
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
                            if (gridCells[cellIndex]) {
                                // (중요) 현재 조각과 겹치지 않는 부분만 지운다.
                                if (!gridCells[cellIndex].classList.contains(currentPiece.color)) {
                                     gridCells[cellIndex].classList.remove('ghost');
                                }
                            }
                        }
                    }
                });
            });
        }

        // 2. 새 고스트 위치 계산 (하드드롭 위치와 동일한 로직)
        const shape = currentPiece.shape;
        let ghostY = currentPosition.y;
        let yOffset = 1;
        
        while (!checkCollision(0, yOffset, shape)) {
            yOffset++;
        }
        ghostY += (yOffset - 1); // 최종 y 위치

        // 3. 새 고스트 정보 저장
        lastGhostPosition = { x: currentPosition.x, y: ghostY };
        lastGhostShapeData = shape;

        // 4. 새 고스트 그리기
        if (lastGhostPosition.y === currentPosition.y) return; // 실제 조각과 같으면 그릴 필요 없음

        lastGhostShapeData.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value === 1) {
                    const boardX = lastGhostPosition.x + x;
                    const boardY = lastGhostPosition.y + y;
                    if (boardY < GRID_HEIGHT && boardX < GRID_WIDTH) {
                        const cellIndex = boardY * GRID_WIDTH + boardX;
                        // (중요) 'locked'된 블록 위에는 그리지 않음
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
     * (수정) 키보드 입력 처리 (switch 문 활용)
     */
    function control(e) {
        if (isGameOver) return;
        
        switch (e.key) {
            case 'ArrowLeft':
                moveLeft();
                break;
            case 'ArrowRight':
                moveRight();
                break;
            case 'ArrowDown':
                moveDown(); // 소프트 드롭
                break;
            case 'ArrowUp':
                rotate(); // 회전
                break;
            case ' ': // 스페이스 바
                hardDrop(); // (추가) 하드 드롭
                break;
            case 'c': // (추가)
            case 'C':
                holdPiece(); // (추가) 홀드
                break;
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
        // (참고) 홀드 UI가 있다면 여기서 초기화
        
        gameBoardModel = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0));
        
        // gameBoard(뷰) 초기화 (updateBoardView가 고스트도 지워줌)
        updateBoardView(); 
        
        if (gameInterval) {
            clearInterval(gameInterval);
        }

        spawnPiece();
        
        gameInterval = setInterval(moveDown, 1000);
    }


    // --- 7. 이벤트 리스너 연결 ---
    
    createBoard();
    document.addEventListener('keydown', control);
    startButton.addEventListener('click', startGame);

});