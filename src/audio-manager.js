/**
 * Gerenciador de áudio responsável por todos os sons e músicas do jogo
 * Utiliza Howler.js para manipulação avançada de áudio web
 */
import { Howl, Howler } from 'https://cdn.jsdelivr.net/npm/howler@2.2.3/+esm';
import { AUDIO } from './config.js';

export class AudioManager {
    constructor() {
        // Verifica se o Howler está disponível
        if (typeof Howl !== 'undefined') {
            // Configurações globais
            Howler.volume(AUDIO.MUSIC_VOLUME);
            
            // Sons do jogo
            this.sounds = {};
            
            // Controle de desempenho de áudio
            this.soundCooldowns = {}; // Controla a taxa de reprodução para cada tipo de som
            this.activeSoundCount = 0; // Monitora o número de sons ativos
            this.maxSimultaneousSounds = 8; // Limita o número máximo de sons simultâneos
            this.lastPlayed = {}; // Armazena o timestamp da última reprodução de cada som
            
            // Tempos mínimos entre reproduções do mesmo som (em ms)
            this.cooldownTimes = {
                shoot: 50,      // Disparo pode ser frequente
                reload: 300,    // Recarga menos frequente
                explosion: 200, // Explosões com intervalo razoável
                empty: 300,     // Som de arma vazia
                hit: 150,       // Sons de impacto
                hurt: 200       // Sons de dano ao jogador
            };
            
            // Carrega todos os sons
            this.loadSounds();
            
            console.log("AudioManager inicializado com otimizações de desempenho");
        } else {
            console.error("Howler não está disponível!");
        }
    }
    
    /**
     * Carrega todos os sons e músicas do jogo
     */
    loadSounds() {
        try {
            // Configuração otimizada para efeitos sonoros
            const commonOptions = {
                preload: true,      // Pré-carrega os sons
                volume: AUDIO.SFX_VOLUME,
                pool: 3            // Limita o número de instâncias simultâneas
            };
            
            // Efeitos sonoros com configurações otimizadas
            this.sounds = {
                // Sons de armas
                shoot: new Howl({
                    src: ['./assets/sounds/shoot.wav'],
                    ...commonOptions,
                    volume: AUDIO.SFX_VOLUME * 0.8 // Volume um pouco reduzido
                }),
                
                // Som de arma vazia
                empty: new Howl({
                    src: ['./assets/sounds/empty.wav'],
                    ...commonOptions,
                    volume: AUDIO.SFX_VOLUME * 0.3
                }),
                
                // Som de explosão
                explosion: new Howl({
                    src: ['./assets/sounds/explosion.wav'],
                    ...commonOptions
                }),
                
                // Som de recarga
                reload: new Howl({
                    src: ['./assets/sounds/reload.wav'],
                    ...commonOptions
                })
            };
            
            const soundsList = Object.keys(this.sounds);
            console.log("Sons carregados:", soundsList.length);
        } catch (error) {
            console.error("Erro ao carregar sons:", error);
        }
    }
    
    /**
     * Solicita o desbloqueio do contexto de áudio após uma interação do usuário
     * Deve ser chamado após um clique ou toque
     */
    unlockAudio() {
        try {
            // Tenta resumir o contexto de áudio
            if (Howler.ctx && Howler.ctx.state !== 'running') {
                Howler.ctx.resume();
                console.log("Contexto de áudio desbloqueado!");
            }
            
            // Reproduz um som silencioso para desbloquear o áudio em alguns navegadores
            const unlockSound = new Howl({
                src: ['data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV'],
                volume: 0.001, // Volume praticamente inaudível
                autoplay: true,
                onend: function() {
                    // Não fazemos nada aqui, apenas para inicializar o áudio
                }
            });
        } catch (error) {
            console.error("Erro ao desbloquear áudio:", error);
        }
    }
    
    /**
     * Reproduz um som com limitação de frequência e quantidade
     * @param {string} soundId - Identificador do som
     * @param {number} volume - Volume opcional (0-1)
     * @param {number} rate - Taxa de reprodução
     * @returns {number|null} - ID da reprodução ou null se não foi possível reproduzir
     */
    play(soundId, volume, rate) {
        // Verifica se o som existe
        if (!this.sounds[soundId]) {
            return null;
        }
        
        // Otimização: limita a quantidade de sons simultâneos
        if (this.activeSoundCount >= this.maxSimultaneousSounds) {
            // Se já temos muitos sons, só reproduz sons importantes
            if (!['shoot', 'hurt', 'explosion'].includes(soundId)) {
                return null;
            }
        }
        
        // Otimização: Verifica cooldown para evitar muitos sons do mesmo tipo
        const now = Date.now();
        const lastPlayed = this.lastPlayed[soundId] || 0;
        const cooldown = this.cooldownTimes[soundId] || 100;
        
        if (now - lastPlayed < cooldown) {
            return null; // Ainda em cooldown, ignora
        }
        
        // Atualiza o timestamp da última reprodução
        this.lastPlayed[soundId] = now;
        
        // Incrementa contador de sons ativos
        this.activeSoundCount++;
        
        // Configura opções
        if (volume !== undefined) {
            this.sounds[soundId].volume(volume);
        }
        
        if (rate !== undefined) {
            this.sounds[soundId].rate(rate);
        }
        
        // Reproduz o som
        const id = this.sounds[soundId].play();
        
        // Registra o callback para quando o som terminar
        this.sounds[soundId].once('end', () => {
            this.activeSoundCount = Math.max(0, this.activeSoundCount - 1);
        }, id);
        
        return id;
    }
    
    /**
     * Reproduz um som 3D com atenuação baseada na distância
     * @param {string} soundId - Identificador do som
     * @param {THREE.Vector3} position - Posição da fonte sonora
     * @param {THREE.Vector3} playerPosition - Posição do jogador
     * @param {number} maxDistance - Distância máxima audível
     * @returns {number|null} - ID da reprodução ou null se não reproduzido
     */
    play3D(soundId, position, playerPosition, maxDistance = AUDIO.MAX_DISTANCE) {
        // Verifica se o som existe
        if (!this.sounds[soundId]) {
            return null;
        }
        
        // Otimização: só calcula distância se o som existe
        // Calcula a distância ao quadrado (mais eficiente que raiz quadrada)
        const dx = playerPosition.x - position.x;
        const dz = playerPosition.z - position.z;
        const distanceSquared = dx * dx + dz * dz;
        const maxDistanceSquared = maxDistance * maxDistance;
        
        // Se estiver além da distância máxima, não reproduz
        if (distanceSquared > maxDistanceSquared) {
            return null;
        }
        
        // Aplica o mesmo controle de taxa que o método play normal
        const now = Date.now();
        const lastPlayed = this.lastPlayed[soundId] || 0;
        const cooldown = this.cooldownTimes[soundId] || 100;
        
        if (now - lastPlayed < cooldown) {
            return null;
        }
        
        // Limite de sons simultâneos
        if (this.activeSoundCount >= this.maxSimultaneousSounds) {
            if (!['explosion', 'hurt'].includes(soundId)) {
                return null;
            }
        }
        
        // Atualiza timestamp
        this.lastPlayed[soundId] = now;
        
        // Calcula volume baseado na distância (mais eficiente)
        const distance = Math.sqrt(distanceSquared);
        const volume = Math.max(0, 1 - (distance / maxDistance)) * AUDIO.SFX_VOLUME;
        
        // Se o volume for muito baixo, nem reproduz
        if (volume < 0.05) {
            return null;
        }
        
        // Incrementa contador
        this.activeSoundCount++;
        
        // Reproduz com o volume calculado
        const id = this.sounds[soundId].play();
        this.sounds[soundId].volume(volume, id);
        
        // Registra callback quando terminar
        this.sounds[soundId].once('end', () => {
            this.activeSoundCount = Math.max(0, this.activeSoundCount - 1);
        }, id);
        
        return id;
    }
    
    /**
     * Para um som específico
     * @param {string} soundId - Identificador do som
     * @param {number} id - ID da reprodução específica (opcional)
     */
    stop(soundId, id) {
        if (this.sounds[soundId]) {
            if (id !== undefined) {
                this.sounds[soundId].stop(id);
                this.activeSoundCount = Math.max(0, this.activeSoundCount - 1);
            } else {
                this.sounds[soundId].stop();
                // Não podemos determinar quantos sons paramos, então não atualizamos activeSounds
            }
        }
    }
    
    /**
     * Inicia a reprodução da música de fundo
     * @param {string} musicId - Identificador da música a ser reproduzida
     * @param {boolean} fadeIn - Se deve fazer fade in (true) ou iniciar imediatamente (false)
     */
    playMusic(musicId, fadeIn = true) {
        // Para a música atual se houver
        this.stopMusic();
        
        const music = this.sounds[musicId];
        
        if (!music) {
            console.warn(`Música não encontrada: ${musicId}`);
            return;
        }
        
        // Configura a referência da música atual
        this.currentMusic = {
            id: musicId,
            sound: music,
            playId: null
        };
        
        // Configura o volume inicial
        if (fadeIn) {
            music.volume(0);
            this.currentMusic.playId = music.play();
            
            // Fade in ao longo de 2 segundos
            music.fade(0, AUDIO.MUSIC_VOLUME, 2000, this.currentMusic.playId);
        } else {
            music.volume(AUDIO.MUSIC_VOLUME);
            this.currentMusic.playId = music.play();
        }
    }
    
    /**
     * Para a reprodução da música de fundo
     * @param {boolean} fadeOut - Se deve fazer fade out (true) ou parar imediatamente (false)
     */
    stopMusic(fadeOut = true) {
        if (!this.currentMusic) return;
        
        const music = this.currentMusic.sound;
        const playId = this.currentMusic.playId;
        
        if (fadeOut) {
            // Fade out ao longo de 1 segundo
            music.fade(AUDIO.MUSIC_VOLUME, 0, 1000, playId);
            
            // Espera o fade terminar antes de parar completamente
            setTimeout(() => {
                music.stop(playId);
            }, 1000);
        } else {
            // Para imediatamente
            music.stop(playId);
        }
        
        this.currentMusic = null;
    }
    
    /**
     * Muda o tema musical com transição suave
     * @param {string} newMusicId - Identificador da nova música
     */
    crossfadeMusic(newMusicId) {
        if (!this.currentMusic) {
            this.playMusic(newMusicId, true);
            return;
        }
        
        const newMusic = this.sounds[newMusicId];
        
        if (!newMusic) {
            console.warn(`Música não encontrada para crossfade: ${newMusicId}`);
            return;
        }
        
        // Fade out na música atual
        const currentMusic = this.currentMusic.sound;
        const currentPlayId = this.currentMusic.playId;
        currentMusic.fade(AUDIO.MUSIC_VOLUME, 0, 1000, currentPlayId);
        
        // Inicia a nova música com fade in
        newMusic.volume(0);
        const newPlayId = newMusic.play();
        newMusic.fade(0, AUDIO.MUSIC_VOLUME, 1000, newPlayId);
        
        // Atualiza a referência da música atual
        this.currentMusic = {
            id: newMusicId,
            sound: newMusic,
            playId: newPlayId
        };
        
        // Para a música anterior após o fade
        setTimeout(() => {
            currentMusic.stop(currentPlayId);
        }, 1000);
    }
    
    /**
     * Configura o volume global da música
     * @param {number} volume - Novo volume (0-1)
     */
    setMusicVolume(volume) {
        AUDIO.MUSIC_VOLUME = Math.max(0, Math.min(1, volume));
        
        // Atualiza o volume da música atual se houver
        if (this.currentMusic) {
            this.currentMusic.sound.volume(AUDIO.MUSIC_VOLUME, this.currentMusic.playId);
        }
    }
    
    /**
     * Configura o volume global dos efeitos sonoros
     * @param {number} volume - Novo volume (0-1)
     */
    setSFXVolume(volume) {
        AUDIO.SFX_VOLUME = Math.max(0, Math.min(1, volume));
    }
    
    /**
     * Silencia ou restaura todo o áudio
     * @param {boolean} muted - Se deve silenciar (true) ou restaurar (false)
     */
    mute(muted) {
        Howler.mute(muted);
    }
} 