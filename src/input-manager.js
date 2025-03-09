/**
 * Gerenciador de entrada responsável por capturar e processar as interações do usuário
 * Lida com entrada de teclado, mouse, e opcionalmente gamepad
 */
export class InputManager {
    constructor() {
        // Estado das teclas
        this.keys = {};
        
        // Estado do mouse
        this.mouse = {
            x: 0,
            y: 0,
            movementX: 0,
            movementY: 0,
            buttons: {
                left: false,
                right: false,
                middle: false
            }
        };
        
        // Movimento acumulado do mouse (para rotação da câmera)
        this.mouseAccumulatedMovement = {
            x: 0,
            y: 0
        };
        
        // Registra os eventos de teclado
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Registra os eventos de mouse
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        // Previne o comportamento padrão do contexto de menu com o botão direito
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Eventos de bloqueio de ponteiro (para FPS)
        document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
        document.addEventListener('pointerlockerror', this.onPointerLockError.bind(this));
        
        // Flag para verificar se o ponteiro está bloqueado
        this.isPointerLocked = false;
    }
    
    /**
     * Evento disparado quando uma tecla é pressionada
     * @param {KeyboardEvent} event - Evento do teclado
     */
    onKeyDown(event) {
        // Registra a tecla como pressionada
        this.keys[event.code] = true;
    }
    
    /**
     * Evento disparado quando uma tecla é solta
     * @param {KeyboardEvent} event - Evento do teclado
     */
    onKeyUp(event) {
        // Registra a tecla como solta
        this.keys[event.code] = false;
    }
    
    /**
     * Evento disparado quando o mouse se move
     * @param {MouseEvent} event - Evento do mouse
     */
    onMouseMove(event) {
        // Atualiza a posição atual do mouse
        this.mouse.x = event.clientX;
        this.mouse.y = event.clientY;
        
        // Se o ponteiro estiver bloqueado, registra o movimento
        if (this.isPointerLocked) {
            this.mouse.movementX = event.movementX || 0;
            this.mouse.movementY = event.movementY || 0;
            
            // Acumula o movimento para a rotação da câmera
            this.mouseAccumulatedMovement.x += event.movementX || 0;
            this.mouseAccumulatedMovement.y += event.movementY || 0;
        }
    }
    
    /**
     * Evento disparado quando um botão do mouse é pressionado
     * @param {MouseEvent} event - Evento do mouse
     */
    onMouseDown(event) {
        switch (event.button) {
            case 0: // Botão esquerdo
                this.mouse.buttons.left = true;
                break;
            case 1: // Botão do meio (roda)
                this.mouse.buttons.middle = true;
                break;
            case 2: // Botão direito
                this.mouse.buttons.right = true;
                break;
        }
    }
    
    /**
     * Evento disparado quando um botão do mouse é solto
     * @param {MouseEvent} event - Evento do mouse
     */
    onMouseUp(event) {
        switch (event.button) {
            case 0: // Botão esquerdo
                this.mouse.buttons.left = false;
                break;
            case 1: // Botão do meio (roda)
                this.mouse.buttons.middle = false;
                break;
            case 2: // Botão direito
                this.mouse.buttons.right = false;
                break;
        }
    }
    
    /**
     * Evento disparado quando o estado do bloqueio do ponteiro muda
     */
    onPointerLockChange() {
        // Atualiza o estado do bloqueio
        this.isPointerLocked = document.pointerLockElement !== null;
    }
    
    /**
     * Evento disparado quando há um erro no bloqueio do ponteiro
     */
    onPointerLockError() {
        console.error('Erro ao tentar bloquear o ponteiro do mouse');
    }
    
    /**
     * Verifica se uma tecla específica está pressionada
     * @param {string} keyCode - Código da tecla a verificar
     * @returns {boolean} - Verdadeiro se a tecla estiver pressionada
     */
    isKeyPressed(keyCode) {
        return this.keys[keyCode] === true;
    }
    
    /**
     * Verifica se qualquer das teclas especificadas está pressionada
     * @param {string[]} keyCodes - Array de códigos de tecla a verificar
     * @returns {boolean} - Verdadeiro se qualquer das teclas estiver pressionada
     */
    isAnyKeyPressed(keyCodes) {
        return keyCodes.some(keyCode => this.isKeyPressed(keyCode));
    }
    
    /**
     * Obtém o vetor de movimento horizontal baseado nas teclas pressionadas
     * @returns {Object} - Objeto com componentes x e z do movimento
     */
    getMovementVector() {
        // Inicializa o vetor de movimento
        const movement = { x: 0, z: 0 };
        
        // Teclas W/S - movimento para frente/trás (eixo Z)
        if (this.isKeyPressed('KeyW') || this.isKeyPressed('ArrowUp')) {
            movement.z = -1; // Movimento para frente
        }
        if (this.isKeyPressed('KeyS') || this.isKeyPressed('ArrowDown')) {
            movement.z = 1; // Movimento para trás
        }
        
        // Teclas A/D - movimento para esquerda/direita (eixo X)
        if (this.isKeyPressed('KeyA') || this.isKeyPressed('ArrowLeft')) {
            movement.x = -1; // Movimento para esquerda
        }
        if (this.isKeyPressed('KeyD') || this.isKeyPressed('ArrowRight')) {
            movement.x = 1; // Movimento para direita
        }
        
        // Normaliza o vetor para evitar movimento mais rápido na diagonal
        const length = Math.sqrt(movement.x * movement.x + movement.z * movement.z);
        if (length > 0) {
            movement.x /= length;
            movement.z /= length;
        }
        
        return movement;
    }
    
    /**
     * Verifica se o jogador está tentando pular
     * @returns {boolean} - Verdadeiro se a tecla de pulo estiver pressionada
     */
    isJumping() {
        return this.isKeyPressed('Space');
    }
    
    /**
     * Verifica se o jogador está tentando correr
     * @returns {boolean} - Verdadeiro se a tecla de corrida estiver pressionada
     */
    isRunning() {
        return this.isKeyPressed('ShiftLeft') || this.isKeyPressed('ShiftRight');
    }
    
    /**
     * Verifica se o jogador está tentando recarregar
     * @returns {boolean} - Verdadeiro se a tecla de recarga estiver pressionada
     */
    isReloading() {
        return this.isKeyPressed('KeyR');
    }
    
    /**
     * Verifica se o jogador está tentando disparar
     * @returns {boolean} - Verdadeiro se o botão de disparo estiver pressionado
     */
    isShooting() {
        return this.mouse.buttons.left;
    }
    
    /**
     * Obtém a rotação da câmera baseada no movimento do mouse
     * @returns {Object} - Rotação em x e y
     */
    getCameraRotation() {
        // Retorna o movimento acumulado e reseta para o próximo frame
        const rotation = {
            x: this.mouseAccumulatedMovement.x,
            y: this.mouseAccumulatedMovement.y
        };
        
        // Reseta o movimento acumulado
        this.mouseAccumulatedMovement.x = 0;
        this.mouseAccumulatedMovement.y = 0;
        
        return rotation;
    }
    
    /**
     * Atualiza o estado do input (chamado a cada frame)
     */
    update() {
        // Qualquer lógica que precise ser executada a cada frame
        // Por enquanto, não precisamos de nada aqui
    }
} 