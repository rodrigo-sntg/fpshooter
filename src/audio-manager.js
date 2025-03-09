/**
 * Gerenciador de áudio responsável por carregar, reproduzir e controlar som
 * Utiliza a biblioteca Howler.js para manipular áudio de forma eficiente
 */
import { Howl, Howler } from 'https://cdn.jsdelivr.net/npm/howler@2.2.3/+esm';
import { AUDIO } from './config.js';

export class AudioManager {
    constructor() {
        // Configura o volume global
        Howler.volume(AUDIO.MUSIC_VOLUME);
        
        // Dicionário de sons
        this.sounds = {};
        
        // Referência para a música de fundo atual
        this.currentMusic = null;
        
        // Carrega os sons
        this.loadSounds();
        
        // Testa se o Howler está funcionando
        if (Howler) {
            console.log("Howler inicializado com sucesso. Volume global:", Howler.volume());
        } else {
            console.error("Howler não está disponível!");
        }
        
        console.log("AudioManager inicializado");
    }
    
    /**
     * Carrega todos os sons e músicas do jogo
     */
    loadSounds() {
        try {
            // Efeitos sonoros
            this.sounds = {
                // Sons de armas
                shoot: new Howl({
                    src: ['./assets/sounds/shoot.wav'],
                    volume: AUDIO.SFX_VOLUME,
                    rate: 1.0,
                    pool: 5 // Permite múltiplas reproduções simultâneas
                }),
                
                // Som de arma vazia (temporário, usando o mesmo som)
                empty: new Howl({
                    src: ['./assets/sounds/empty.wav'], // Usando arquivo dedicado
                    volume: AUDIO.SFX_VOLUME * 0.3,
                    rate: 0.7 // Mais lento para diferenciar
                }),
                
                // Som de explosão
                explosion: new Howl({
                    src: ['./assets/sounds/explosion.wav'],
                    volume: AUDIO.SFX_VOLUME
                }),
                
                // Som de recarga
                reload: new Howl({
                    src: ['./assets/sounds/reload.wav'],
                    volume: AUDIO.SFX_VOLUME
                })
            };
            
            console.log("Sons carregados com sucesso:", Object.keys(this.sounds));
        } catch (error) {
            console.error("Erro ao carregar sons:", error);
        }
    }
    
    /**
     * Reproduz um efeito sonoro
     * @param {string} soundId - Identificador do som a ser reproduzido
     * @param {number} volume - Volume (0-1) para este som específico (opcional)
     * @param {number} rate - Taxa de reprodução (1.0 é normal, valores maiores mais rápido) (opcional)
     * @returns {number} - ID da reprodução do som
     */
    play(soundId, volume, rate) {
        if (!this.sounds[soundId]) {
            console.warn(`Som não encontrado: ${soundId}. Sons disponíveis:`, Object.keys(this.sounds));
            return -1;
        }
        
        try {
            const sound = this.sounds[soundId];
            
            // Ajusta volume se especificado
            if (volume !== undefined) {
                sound.volume(volume);
            }
            
            // Ajusta rate se especificado
            if (rate !== undefined) {
                sound.rate(rate);
            }
            
            // Exibe informações do som antes de reproduzir
            console.log(`Reproduzindo som "${soundId}":`, {
                volume: sound.volume(),
                rate: sound.rate(),
                src: sound._src
            });
            
            // Reproduz o som e retorna o ID da reprodução
            const id = sound.play();
            console.log(`Som "${soundId}" reproduzido com ID: ${id}`);
            return id;
        } catch (error) {
            console.error(`Erro ao reproduzir som "${soundId}":`, error);
            return -1;
        }
    }
    
    /**
     * Reproduz um som 3D baseado na posição relativa ao jogador
     * @param {string} soundId - Identificador do som a ser reproduzido
     * @param {THREE.Vector3} position - Posição 3D da origem do som
     * @param {THREE.Vector3} playerPosition - Posição 3D do jogador
     * @param {number} maxDistance - Distância máxima para ouvir o som
     * @returns {number} - ID da reprodução do som
     */
    play3D(soundId, position, playerPosition, maxDistance = AUDIO.MAX_DISTANCE) {
        const sound = this.sounds[soundId];
        
        if (!sound) {
            console.warn(`Som não encontrado: ${soundId}`);
            return -1;
        }
        
        // Calcula distância entre jogador e origem do som
        const dx = playerPosition.x - position.x;
        const dy = playerPosition.y - position.y;
        const dz = playerPosition.z - position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // Se a distância for maior que a máxima, não reproduz o som
        if (distance > maxDistance) {
            return -1;
        }
        
        // Calcula volume baseado na distância (atenuação linear)
        const volume = Math.max(0, AUDIO.SFX_VOLUME * (1 - distance / maxDistance));
        
        // Calcula a estereofonia (pan) baseado na posição horizontal relativa
        const pan = Math.max(-1, Math.min(1, dx / maxDistance * 2));
        
        // Configura as propriedades espaciais
        sound.volume(volume);
        sound.stereo(pan);
        
        // Reproduz o som e retorna o ID da reprodução
        return sound.play();
    }
    
    /**
     * Para a reprodução de um som
     * @param {string} soundId - Identificador do som a ser parado
     * @param {number} id - ID da reprodução específica (opcional)
     */
    stop(soundId, id) {
        const sound = this.sounds[soundId];
        
        if (!sound) {
            console.warn(`Som não encontrado para parar: ${soundId}`);
            return;
        }
        
        if (id !== undefined) {
            // Para uma reprodução específica
            sound.stop(id);
        } else {
            // Para todas as reproduções deste som
            sound.stop();
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