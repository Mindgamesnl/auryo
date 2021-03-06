/* eslint-disable global-require */
import { ipcRenderer } from 'electron';
import is from 'electron-is';
import moment from 'moment';
import { toastr } from 'react-redux-toastr';
import { push } from 'react-router-redux';
import { show } from 'redux-modal';
import fetchToJson from '../../api/helpers/fetchToJson';
import * as actionTypes from '../../constants/actionTypes';
import { EVENTS } from '../../constants/events';
import { PLAYER_STATUS, VOLUME_TYPES } from '../../constants/player';
import { SC } from '../../utils';
import { setConfigKey } from '../config.actions';
import { changeTrack, toggleStatus } from '../player/playerActions';
import { toggleLike } from '../track/like.actions';
import { toggleRepost } from '../track/reposts.actions';
import { isOnline } from './offline.actions';

export function openExternal(url) {
    ipcRenderer.send(EVENTS.APP.OPEN_EXTERNAL, url)
}

export function writeToClipboard(content) {
    ipcRenderer.send(EVENTS.APP.WRITE_CLIPBOARD, content)
}

export function downloadFile(url) {
    ipcRenderer.send(EVENTS.APP.DOWNLOAD_FILE, url)
}

let listeners = []

export function initWatchers() {
    return (dispatch, getState) => {

        if (!listeners.length) {
            listeners.push({
                event: 'navigate',
                handler: (data) => {
                    dispatch(push(data))
                }
            })

            listeners.push({
                event: EVENTS.PLAYER.CHANGE_TRACK,
                handler: (e, data) => {
                    dispatch(changeTrack(data))
                }
            })


            listeners.push({
                event: EVENTS.APP.OPEN_SETTINGS,
                handler: () => {
                    dispatch(show('utilities', {
                        activeTab: 'settings'
                    }))
                }
            })

            listeners.push({
                event: EVENTS.PLAYER.CHANGE_VOLUME,
                handler: (e, data) => {
                    const { config: { volume } } = getState()

                    let new_volume = volume + .05

                    if (data === VOLUME_TYPES.DOWN) {
                        new_volume = volume - .05
                    }

                    if (new_volume > 1) {
                        new_volume = 1
                    } else if (new_volume < 0) {
                        new_volume = 0
                    }

                    if (volume !== new_volume) {
                        dispatch(setConfigKey('volume', new_volume))
                    }
                }
            })

            listeners.push({
                event: EVENTS.PLAYER.TOGGLE_STATUS,
                handler: (e, newStatus) => {

                    const { player: { status } } = getState()

                    if (!newStatus || typeof newStatus !== "string") {
                        newStatus = status !== PLAYER_STATUS.PLAYING ? PLAYER_STATUS.PLAYING : PLAYER_STATUS.PAUSED
                    }
                    dispatch(toggleStatus(newStatus))
                }
            })

            listeners.push({
                event: EVENTS.TRACK.LIKE,
                handler: (e, trackId) => {
                    if (trackId) {
                        dispatch(toggleLike(trackId, false))
                    }
                }
            })

            listeners.push({
                event: EVENTS.TRACK.REPOST,
                handler: (e, trackId) => {
                    if (trackId) {
                        dispatch(toggleRepost(trackId, false))
                    }
                }
            })

            listeners.push({
                event: EVENTS.APP.STREAMED,
                handler: () => {

                    const { config: { app: { analytics } } } = getState()

                    if (process.env.NODE_ENV === 'production' && analytics) {
                        const ua = require('../../utils/universalAnalytics')
                        ua().event('SoundCloud', 'Play').send()
                    }
                }
            })

            listeners.push({
                event: EVENTS.APP.STREAM_ERROR,
                handler: (e, httpResponse, url) => {

                    const { app: { offline }, config: { app: { analytics } } } = getState()

                    switch (httpResponse) {
                        case -1:
                            if (!offline) {
                                dispatch(isOnline())
                            }
                            break
                        case 404:
                            toastr.error('Not found!', 'This resource might not exists anymore')
                            break
                        case 429:
                            if (!url) return;
                            return fetchToJson(url)
                                .then((json) => {
                                    if (json.errors.length > 0) {
                                        const error = json.errors[0]

                                        if (error.meta.rate_limit) {

                                            toastr.error('Stream limit reached!', `Unfortunately the API enforces a 15K plays/hour limit. this limit will expire in ${moment(error.meta.reset_time).toNow()}`)

                                            if (process.env.NODE_ENV === 'production' && analytics) {
                                                const ua = require('../../utils/universalAnalytics')
                                                ua().event('SoundCloud', 'Rate limit reached').send()
                                            }
                                        }
                                    }
                                })
                        default:
                            break;
                    }
                }
            })

            listeners.push({
                event: EVENTS.APP.UPDATE_AVAILABLE,
                handler: (e, data) => {
                    dispatch(setUpdateAvailable(data.version))

                    toastr.success(`Update available v${data.version}`, `Current version: ${data.current_version}`, {
                        timeOut: 5000,
                        showCloseButton: false
                    })

                }
            })

            listeners.forEach(l => {
                ipcRenderer.on(l.event, l.handler)
            })
        }
    }
}

export function stopWatchers() {
    return () => {
        listeners.forEach(l => {
            ipcRenderer.removeListener(l.event, l.handler)
        })

        listeners = []
    }
}

/**
 * Set app update available
 *
 * @param version
 * @returns {{type, version: *}}
 */
function setUpdateAvailable(version) {
    return {
        type: actionTypes.APP_SET_UPDATE_AVAILABLE,
        payload: {
            version
        }
    }
}


export function resolveUrl(url, history) {
    if (is.renderer()) {
        fetchToJson(SC.resolveUrl(url))
            .then(json => {
                console.log("response", json)
                switch (json.kind) {
                    case 'track':
                        return history.replace(`/track/${json.id}`)
                    case 'user':
                        return history.replace(`/user/${json.id}`)
                    default:
                        throw Error('Not implemented')
                }
            })
            .catch(() => {
                history.goBack()
                openExternal(unescape(url))
            })

    }
}