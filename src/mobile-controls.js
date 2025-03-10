/**
 * Gerenciador de controles para dispositivos móveis
 * Implementa joysticks virtuais e botões de ação para tela sensível ao toque
 */
export class MobileControls {
    /**
     * @param {InputManager} inputManager - Referência para o gerenciador de input
     */
    constructor(inputManager) {
        this.inputManager = inputManager;
        this.enabled = false;
        
        // Estado dos joysticks
        this.leftJoystick = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            element: null,
            knob: null,
            vector: { x: 0, z: 0 }
        };
        
        this.rightJoystick = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            element: null,
            knob: null,
            vector: { x: 0, y: 0 }
        };
        
        // Estado dos botões
        this.buttons = {
            shoot: { active: false, element: null },
            reload: { active: false, element: null }
        };
        
        // Detecta se é dispositivo móvel
        this.isMobile = this.detectMobile();
        
        // Inicializa o sistema se for dispositivo móvel
        if (this.isMobile) {
            this.init();
        }
    }
    
    /**
     * Detecta se é um dispositivo móvel
     * @returns {boolean} - Verdadeiro se for dispositivo móvel
     */
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               (window.matchMedia && window.matchMedia("(max-width: 767px)").matches);
    }
    
    /**
     * Inicializa o sistema de controles móveis
     */
    init() {
        console.log("Inicializando controles móveis...");
        
        // Cria os elementos de UI
        this.createUI();
        
        // Configura eventos de touch
        this.setupTouchEvents();
        
        // Ativa os controles móveis
        this.enable();
        
        console.log("Controles móveis inicializados!");
    }
    
    /**
     * Cria os elementos de UI para controles móveis
     */
    createUI() {
        // Container para controles móveis
        this.container = document.createElement('div');
        this.container.id = 'mobile-controls';
        this.container.style.display = 'none';
        document.getElementById('game-container').appendChild(this.container);
        
        // Joystick esquerdo (movimento)
        this.leftJoystick.element = this.createJoystick('left-joystick', 'Mover');
        this.leftJoystick.knob = this.leftJoystick.element.querySelector('.joystick-knob');
        
        // Joystick direito (visão)
        this.rightJoystick.element = this.createJoystick('right-joystick', 'Olhar');
        this.rightJoystick.knob = this.rightJoystick.element.querySelector('.joystick-knob');
        
        // Botão de disparo
        this.buttons.shoot.element = this.createButton('shoot-button', 'Atirar');
        
        // Botão de recarga
        this.buttons.reload.element = this.createButton('reload-button', 'Recarregar');
        
        // Adiciona todos os elementos ao container
        this.container.appendChild(this.leftJoystick.element);
        this.container.appendChild(this.rightJoystick.element);
        this.container.appendChild(this.buttons.shoot.element);
        this.container.appendChild(this.buttons.reload.element);
        
        // Adiciona folha de estilo para controles móveis
        this.addStyles();
    }
    
    /**
     * Cria um joystick virtual
     * @param {string} id - ID do elemento
     * @param {string} label - Texto de label
     * @returns {HTMLElement} - Elemento do joystick
     */
    createJoystick(id, label) {
        const joystick = document.createElement('div');
        joystick.id = id;
        joystick.className = 'joystick';
        
        const joystickBg = document.createElement('div');
        joystickBg.className = 'joystick-bg';
        
        const joystickKnob = document.createElement('div');
        joystickKnob.className = 'joystick-knob';
        
        const joystickLabel = document.createElement('div');
        joystickLabel.className = 'joystick-label';
        joystickLabel.textContent = label;
        
        joystick.appendChild(joystickBg);
        joystick.appendChild(joystickKnob);
        joystick.appendChild(joystickLabel);
        
        return joystick;
    }
    
    /**
     * Cria um botão virtual
     * @param {string} id - ID do elemento
     * @param {string} label - Texto do botão
     * @returns {HTMLElement} - Elemento do botão
     */
    createButton(id, label) {
        const button = document.createElement('div');
        button.id = id;
        button.className = 'mobile-button';
        button.textContent = label;
        return button;
    }
    
    /**
     * Adiciona os estilos CSS para os controles móveis
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #mobile-controls {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1000;
                touch-action: none;
            }
            
            .joystick {
                position: absolute;
                width: 120px;
                height: 120px;
                pointer-events: auto;
            }
            
            #left-joystick {
                bottom: 30px;
                left: 30px;
            }
            
            #right-joystick {
                bottom: 30px;
                right: 30px;
            }
            
            .joystick-bg {
                position: absolute;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background-color: rgba(255, 255, 255, 0.2);
                border: 2px solid rgba(255, 255, 255, 0.3);
            }
            
            .joystick-knob {
                position: absolute;
                width: 50%;
                height: 50%;
                left: 25%;
                top: 25%;
                border-radius: 50%;
                background-color: rgba(255, 255, 255, 0.7);
                border: 2px solid rgba(0, 0, 0, 0.3);
            }
            
            .joystick-label {
                position: absolute;
                width: 100%;
                text-align: center;
                bottom: -25px;
                color: rgba(255, 255, 255, 0.7);
                font-size: 14px;
            }
            
            .mobile-button {
                position: absolute;
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background-color: rgba(255, 255, 255, 0.2);
                border: 2px solid rgba(255, 255, 255, 0.3);
                color: rgba(255, 255, 255, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                pointer-events: auto;
            }
            
            #shoot-button {
                bottom: 100px;
                right: 30px;
                background-color: rgba(255, 0, 0, 0.3);
            }
            
            #reload-button {
                bottom: 30px;
                right: 150px;
                background-color: rgba(0, 255, 0, 0.3);
            }
            
            .mobile-button.active {
                background-color: rgba(255, 255, 255, 0.5);
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Configura os eventos de touch
     */
    setupTouchEvents() {
        // Eventos para o joystick esquerdo (movimento)
        this.setupJoystickEvents(this.leftJoystick);
        
        // Eventos para o joystick direito (visão)
        this.setupJoystickEvents(this.rightJoystick);
        
        // Evento para o botão de tiro
        this.setupButtonEvents(this.buttons.shoot, () => {
            this.inputManager.setShootingState(true);
        }, () => {
            this.inputManager.setShootingState(false);
        });
        
        // Evento para o botão de recarga
        this.setupButtonEvents(this.buttons.reload, () => {
            this.inputManager.setReloadingState(true);
        }, () => {
            this.inputManager.setReloadingState(false);
        });
        
        // Previne o comportamento padrão de toques na tela
        document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    }
    
    /**
     * Configura eventos para um joystick
     * @param {Object} joystick - Objeto do joystick
     */
    setupJoystickEvents(joystick) {
        const element = joystick.element;
        
        // Evento touchstart
        element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            joystick.active = true;
            
            // Posição inicial do toque
            const rect = element.getBoundingClientRect();
            joystick.startX = rect.left + rect.width / 2;
            joystick.startY = rect.top + rect.height / 2;
            
            // Posição atual do toque
            joystick.currentX = touch.clientX;
            joystick.currentY = touch.clientY;
            
            // Atualiza a posição do knob
            this.updateJoystickVisual(joystick);
        });
        
        // Evento touchmove
        element.addEventListener('touchmove', (e) => {
            if (!joystick.active) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            joystick.currentX = touch.clientX;
            joystick.currentY = touch.clientY;
            
            // Atualiza a posição do knob
            this.updateJoystickVisual(joystick);
            
            // Atualiza o vetor de movimento/visão
            this.updateJoystickVector(joystick);
        });
        
        // Evento touchend
        element.addEventListener('touchend', (e) => {
            e.preventDefault();
            joystick.active = false;
            
            // Reseta o joystick
            joystick.knob.style.transform = 'translate(0, 0)';
            joystick.vector = { x: 0, y: 0, z: 0 };
            
            // Reseta o estado do input
            if (element.id === 'left-joystick') {
                this.inputManager.setMovementVector({ x: 0, z: 0 });
            } else {
                this.inputManager.setCameraRotation({ x: 0, y: 0 });
            }
        });
    }
    
    /**
     * Configura eventos para um botão
     * @param {Object} button - Objeto do botão
     * @param {function} onPress - Função a ser chamada quando pressionado
     * @param {function} onRelease - Função a ser chamada quando solto
     */
    setupButtonEvents(button, onPress, onRelease) {
        const element = button.element;
        
        // Evento touchstart
        element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            button.active = true;
            element.classList.add('active');
            if (onPress) onPress();
        });
        
        // Evento touchend
        element.addEventListener('touchend', (e) => {
            e.preventDefault();
            button.active = false;
            element.classList.remove('active');
            if (onRelease) onRelease();
        });
    }
    
    /**
     * Atualiza a representação visual do joystick
     * @param {Object} joystick - Objeto do joystick
     */
    updateJoystickVisual(joystick) {
        // Calcula o deslocamento do knob
        let deltaX = joystick.currentX - joystick.startX;
        let deltaY = joystick.currentY - joystick.startY;
        
        // Limita o deslocamento máximo (raio)
        const maxRadius = 40;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > maxRadius) {
            const factor = maxRadius / distance;
            deltaX *= factor;
            deltaY *= factor;
        }
        
        // Aplica o deslocamento ao knob
        joystick.knob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    }
    
    /**
     * Atualiza o vetor de movimento/visão do joystick
     * @param {Object} joystick - Objeto do joystick
     */
    updateJoystickVector(joystick) {
        // Calcula o vetor normalizado
        let deltaX = joystick.currentX - joystick.startX;
        let deltaY = joystick.currentY - joystick.startY;
        
        const maxRadius = 40;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Normaliza os valores para o intervalo [-1, 1]
        let normalizedX = 0;
        let normalizedY = 0;
        
        if (distance > 0) {
            normalizedX = deltaX / maxRadius;
            normalizedY = deltaY / maxRadius;
            
            // Limita os valores ao intervalo [-1, 1]
            normalizedX = Math.max(-1, Math.min(1, normalizedX));
            normalizedY = Math.max(-1, Math.min(1, normalizedY));
        }
        
        // Atualiza o vetor de acordo com o tipo de joystick
        if (joystick.element.id === 'left-joystick') {
            // Joystick esquerdo controla movimento
            this.inputManager.setMovementVector({
                x: normalizedX,
                z: normalizedY
            });
        } else {
            // Joystick direito controla visão
            this.inputManager.setCameraRotation({
                x: normalizedX * 2, // Aumenta a sensibilidade
                y: normalizedY * 2
            });
        }
    }
    
    /**
     * Ativa os controles móveis
     */
    enable() {
        if (this.container) {
            this.container.style.display = 'block';
            this.enabled = true;
        }
    }
    
    /**
     * Desativa os controles móveis
     */
    disable() {
        if (this.container) {
            this.container.style.display = 'none';
            this.enabled = false;
        }
    }
    
    /**
     * Atualiza o estado dos controles
     */
    update() {
        // Nada a fazer aqui por enquanto
    }
} 