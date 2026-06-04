// ==UserScript==
// @name         ChatGPT-FullWidth
// @name:zh-CN    ChatGPT 宽屏模式
// @namespace    https://github.com/deathmorris/ChatGPT-FullWidth
// @version      1.0.8
// @description  Expand ChatGPT content width and adapt layout to wide screens, reducing scrolling.
// @description:zh-CN  扩展 ChatGPT 页面内容宽度，自适应宽屏显示，减少滚动次数。
// @author       Quillon
// @license      MIT
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @require             https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@3.1.0/dist/chatgpt.min.js#sha2567NZavwKnOeU+AC6WBVJP9kl6BNFlT7go8qSKat7Ey4Y=
// @noframes
// ==/UserScript==
 
(async () => { /* global newChatBtn, wideScreenBtn, fullWindowBtn, fullScreenBtn */
 
    const site = new URL(location.href).hostname.split('.').slice(-2, -1)[0]
 
    // Init APP INFO
    const app = {
        name: 'ChatGPT Widescreen Mode', symbol: '🖥️', configKeyPrefix: site + 'Widescreen',
        urls: {
            gitHub: 'https://github.com/adamlui/chatgpt-widescreen',
            greasyFork: 'https://greasyfork.org/scripts/461473-chatgpt-widescreen-mode',
            support: 'https://support.chatgptwidescreen.com' },
        latestAssetCommitHash: '3047fa8' // for cached messages.json
    }
    app.urls.assetHost = app.urls.gitHub.replace('github.com', 'cdn.jsdelivr.net/gh') + `@${app.latestAssetCommitHash}/`
    app.urls.update = app.urls.greasyFork.replace('https://', 'https://update.')
        .replace(/(\d+)-?([a-zA-Z-]*)$/, (_, id, name) => `${id}/${ !name ? 'script' : name }.meta.js`)
 
    // USER ADJUSTABLE: Right margin (px) reserved for third-party plugin buttons (e.g. ChatGPT Exporter)
    // Increase this value if your plugin buttons are being pushed off-screen by the widened layout.
    // Set to 0 if you don't have any right-side plugin buttons.
    const PLUGIN_RIGHT_MARGIN = 130 // px — change this to match your plugin button width
 
    // Init CONFIG
    const config = { userLanguage: chatgpt.getUserLanguage() }
    loadSetting('autoFocusChatbarDisabled', 'fullerWindows', 'fullWindow', 'hiddenFooter', 'hiddenHeader',
                'notifDisabled', 'ncbDisabled', 'tcbDisabled', 'widerChatbox', 'wideScreen')
    config.autoAdaptive = GM_getValue(`${app.configKeyPrefix}_${site}_autoAdaptive`, true) // default ON
 
    // Init FETCHER
    const xhr = getUserscriptManager() == 'OrangeMonkey' ? GM_xmlhttpRequest : GM.xmlHttpRequest
 
    // Define MESSAGES
    const msgsLoaded = new Promise(resolve => {
        const msgHostDir = app.urls.assetHost + 'greasemonkey/_locales/',
              msgLocaleDir = ( config.userLanguage ? config.userLanguage.replace('-', '_') : 'en' ) + '/'
        let msgHref = msgHostDir + msgLocaleDir + 'messages.json', msgXHRtries = 0
        xhr({ method: 'GET', url: msgHref, onload: onLoad })
        function onLoad(resp) {
            try { // to return localized messages.json
                const msgs = JSON.parse(resp.responseText), flatMsgs = {}
                for (const key in msgs)  // remove need to ref nested keys
                    if (typeof msgs[key] == 'object' && 'message' in msgs[key])
                        flatMsgs[key] = msgs[key].message
                resolve(flatMsgs)
            } catch (err) { // if bad response
                msgXHRtries++ ; if (msgXHRtries == 3) return resolve({}) // try up to 3X (original/region-stripped/EN) only
                msgHref = config.userLanguage.includes('-') && msgXHRtries == 1 ? // if regional lang on 1st try...
                    msgHref.replace(/([^_]+_[^_]+)_[^/]*(\/.*)/, '$1$2') // ...strip region before retrying
                        : ( msgHostDir + 'en/messages.json' ) // else use default English messages
                xhr({ method: 'GET', url: msgHref, onload: onLoad })
            }
        }
    }) ; const msgs = await msgsLoaded
 
    // Define SCRIPT functions
 
    function loadSetting(...keys) { keys.forEach(key => config[key] = GM_getValue(`${ app.configKeyPrefix }_${ site }_${ key }`, false)) }
    function saveSetting(key, value) { GM_setValue(`${ app.configKeyPrefix }_${ site }_${ key }`, value) ; config[key] = value }
    function safeWindowOpen(url) { window.open(url, '_blank', 'noopener') } // to prevent backdoor vulnerabilities
    function getUserscriptManager() { try { return GM_info.scriptHandler } catch (err) { return 'other' }}
 
    // Define MENU functions
 
    function registerMenu() {
 
        // Add command to also activate wide screen in full-window
        const fwLabel = menuState.symbol[+config.fullerWindows] + ' '
                      + ( msgs.menuLabel_fullerWins || 'Fuller Windows' )
                      + menuState.separator + menuState.word[+config.fullerWindows]
        menuIDs.push(GM_registerMenuCommand(fwLabel, () => {
            saveSetting('fullerWindows', !config.fullerWindows)
            syncFullerWindows(config.fullerWindows) // live update on click
            if (!config.notifDisabled) notify(
                `${ ( msgs.menuLabel_fullerWins || 'Fuller Windows' ) }: ${ menuState.word[+config.fullerWindows] }`)
            refreshMenu()
        }))
 
        // Add command to toggle taller chatbox when typing
        const tcbLabel = '↕️ ' + ( msgs.menuLabel_tallerChatbox || 'Taller Chatbox' )
                       + menuState.separator + menuState.word[+!config.tcbDisabled]
        menuIDs.push(GM_registerMenuCommand(tcbLabel, () => {
            saveSetting('tcbDisabled', !config.tcbDisabled)
            updateTweaksStyle()
            if (!config.notifDisabled) notify(
                `${ msgs.menuLabel_tallerChatbox || 'Taller Chatbox' }: ${ menuState.word[+!config.tcbDisabled] }`)
            refreshMenu()
        }))
 
        // Add command to hide New Chat button
        const hncLabel = menuState.symbol[+!config.ncbDisabled] + ' '
                       + ( msgs.menuLabel_newChatBtn || 'New Chat Button' )
                       + menuState.separator + menuState.word[+!config.ncbDisabled]
        menuIDs.push(GM_registerMenuCommand(hncLabel, () => {
            saveSetting('ncbDisabled', !config.ncbDisabled)
            updateTweaksStyle()
            notify(`${ msgs.menuLabel_newChatBtn || 'New Chat Button' }: ${ menuState.word[+!config.ncbDisabled] }`)
            refreshMenu()
        }))
 
        if (/chatgpt|openai/.test(site)) {
 
            // Add command to toggle Auto-Focus Chatbar
            const afcLabel = menuState.symbol[+!config.autoFocusChatbarDisabled] + ' '
                           + ( msgs.menuLabel_autoFocusChatbar || 'Auto-Focus Chatbar' ) + ' '
                           + menuState.separator + menuState.word[+!config.autoFocusChatbarDisabled]
            menuIDs.push(GM_registerMenuCommand(afcLabel, () => {
                saveSetting('autoFocusChatbarDisabled', !config.autoFocusChatbarDisabled)
                notify(( msgs.menuLabel_autoFocusChatbar || 'Auto-Focus Chatbar' ) + ' '
                             + menuState.word[+!config.autoFocusChatbarDisabled])
                if (!config.autoFocusChatbarDisabled) document.querySelector(inputSelector)?.focus()
                refreshMenu()
            }))
 
            // Add command to toggle hidden header
            const hhLabel = menuState.symbol[+config.hiddenHeader] + ' '
                          + ( msgs.menuLabel_hiddenHeader || 'Hidden Header' )
                          + menuState.separator + menuState.word[+config.hiddenHeader]
            menuIDs.push(GM_registerMenuCommand(hhLabel, () => {
                saveSetting('hiddenHeader', !config.hiddenHeader)
                updateTweaksStyle()
                if (!config.notifDisabled) notify(
                    `${ msgs.menuLabel_hiddenHeader || 'Hidden Header' }: ${ menuState.word[+config.hiddenHeader] }`)
                refreshMenu()
            }))
 
            // Add command to toggle hidden footer
            const hfLabel = menuState.symbol[+config.hiddenFooter] + ' '
                          + ( msgs.menuLabel_hiddenFooter || 'Hidden Footer' )
                          + menuState.separator + menuState.word[+config.hiddenFooter]
            menuIDs.push(GM_registerMenuCommand(hfLabel, () => {
                saveSetting('hiddenFooter', !config.hiddenFooter)
                updateTweaksStyle()
                if (!config.notifDisabled) notify(
                    `${ msgs.menuLabel_hiddenFooter || 'Hidden Footer' }: ${ menuState.word[+config.hiddenFooter] }`)
                refreshMenu()
            }))
        }
 
        // Add command to show notifications when switching modes
        const mnLabel = menuState.symbol[+!config.notifDisabled] + ' '
                      + ( msgs.menuLabel_modeNotifs || 'Mode Notifications' )
                      + menuState.separator + menuState.word[+!config.notifDisabled]
        menuIDs.push(GM_registerMenuCommand(mnLabel, () => {
            saveSetting('notifDisabled', !config.notifDisabled)
            notify(`${ msgs.menuLabel_modeNotifs || 'Mode Notifications' }: ${ menuState.word[+!config.notifDisabled] }`)
            refreshMenu()
        }))
 
        // Add command to toggle Auto-Adaptive mode
        const aaLabel = '🖥️ Auto-Adaptive' + menuState.separator + menuState.word[+config.autoAdaptive]
        menuIDs.push(GM_registerMenuCommand(aaLabel, () => {
            config.autoAdaptive = !config.autoAdaptive
            saveSetting('autoAdaptive', config.autoAdaptive)
            if (config.autoAdaptive) {
                prevScreenProfile = detectScreenProfile()
                applyAdaptiveWidth(prevScreenProfile)
            } else {
                adaptiveStyle.innerText = '' // clear adaptive overrides
            }
            if (!config.notifDisabled) notify(`Auto-Adaptive: ${menuState.word[+config.autoAdaptive]}`)
            refreshMenu()
        }))
 
        // Add command to launch About modal
        const amLabel = `💡 ${ msgs.menuLabel_about || 'About' } ${ msgs.appName || app.name }`
        menuIDs.push(GM_registerMenuCommand(amLabel, launchAboutModal))
    }
 
    function refreshMenu() {
        if (getUserscriptManager() == 'OrangeMonkey') return
        for (const id of menuIDs) { GM_unregisterMenuCommand(id) } registerMenu()
    }
 
    function launchAboutModal() {
 
        // Show alert
        const chatgptJSver = (/chatgpt-([\d.]+)\.min/.exec(GM_info.script.header) || [null, ''])[1],
              headingStyle = 'font-size: 1.15rem',
              pStyle = 'position: relative ; left: 3px',
              pBrStyle = 'position: relative ; left: 4px ',
              aStyle = 'color: ' + ( chatgpt.isDarkMode() ? '#c67afb' : '#8325c4' ) // purple
        const aboutModalID = siteAlert(
            msgs.appName || app.name, // title
            `<span style="${ headingStyle }"><b>🏷️ <i>${ msgs.about_version || 'Version' }</i></b>: </span>`
                + `<span style="${ pStyle }">${ GM_info.script.version }</span>\n`
            + `<span style="${ headingStyle }"><b>⚡ <i>${ msgs.about_poweredBy || 'Powered by' }</i></b>: </span>`
                + `<span style="${ pStyle }"><a style="${ aStyle }" href="https://chatgpt.js.org" target="_blank" rel="noopener">`
                + 'chatgpt.js</a>' + ( chatgptJSver ? ( ' v' + chatgptJSver ) : '' ) + '</span>\n'
            + `<span style="${ headingStyle }"><b>📜 <i>${ msgs.about_sourceCode || 'Source code' }</i></b>:</span>\n`
                + `<span style="${ pBrStyle }"><a href="${ app.urls.gitHub }" target="_blank" rel="nopener">`
                + app.urls.gitHub + '</a></span>',
            [ // buttons
                function checkForUpdates() { updateCheck() },
                function getSupport() { safeWindowOpen(app.urls.support) },
                function leaveAReview() { // show new modal
                    const reviewModalID = chatgpt.alert(( msgs.alert_choosePlatform || 'Choose a Platform' ) + ':', '',
                        [ function greasyFork() { safeWindowOpen(app.urls.greasyFork + '/feedback#post-discussion') },
                          function productHunt() { safeWindowOpen(
                              'https://www.producthunt.com/products/chatgpt-widescreen-mode/reviews/new') }])
                    document.getElementById(reviewModalID).querySelector('button')
                        .style.display = 'none' }, // hide dismiss button
                function moreChatGPTapps() { safeWindowOpen('https://github.com/adamlui/chatgpt-apps') }
            ], '', 478 // set width
        )
 
        // Re-format buttons to include emoji + localized label + hide Dismiss button
        for (const button of document.getElementById(aboutModalID).querySelectorAll('button')) {
            if (/updates/i.test(button.textContent)) button.textContent = (
                '🚀 ' + ( msgs.btnLabel_updateCheck || 'Check for Updates' ))
            else if (/support/i.test(button.textContent)) button.textContent = (
                '🧠 ' + ( msgs.btnLabel_getSupport || 'Get Support' ))
            else if (/review/i.test(button.textContent)) button.textContent = (
                '⭐ ' + ( msgs.btnLabel_leaveReview || 'Leave Review' ))
            else if (/apps/i.test(button.textContent)) button.textContent = (
                '🤖 ' + ( msgs.btnLabel_moreApps || 'More ChatGPT Apps' ))
            else button.style.display = 'none' // hide Dismiss button
        }
    }
 
    function updateCheck() {
 
        // Fetch latest meta
        const currentVer = GM_info.script.version
        xhr({
            method: 'GET', url: app.urls.update + '?t=' + Date.now(),
            headers: { 'Cache-Control': 'no-cache' },
            onload: response => { const updateAlertWidth = 377
 
                // Compare versions
                const latestVer = /@version +(.*)/.exec(response.responseText)[1]
                for (let i = 0 ; i < 4 ; i++) { // loop thru subver's
                    const currentSubVer = parseInt(currentVer.split('.')[i], 10) || 0,
                          latestSubVer = parseInt(latestVer.split('.')[i], 10) || 0
                    if (currentSubVer > latestSubVer) break // out of comparison since not outdated
                    else if (latestSubVer > currentSubVer) { // if outdated
 
                        // Alert to update
                        const updateModalID = siteAlert(`🚀 ${ msgs.alert_updateAvail || 'Update available' }!`, // title
                            `${ msgs.alert_newerVer || 'An update to' } ${ app.name } `
                                + ( msgs.appName || app.name ) + ' '
                                + `(v${ latestVer }) ${ msgs.alert_isAvail || 'is available' }!  `
                                + '<a target="_blank" rel="noopener" style="font-size: 0.7rem" '
                                    + 'href="' + app.urls.gitHub + '/commits/main/greasemonkey/'
                                    + app.urls.update.replace(/.*\/(.*)meta\.js/, '$1user.js') + '"'
                                    + `> ${ msgs.link_viewChanges || 'View changes' }</a>`,
                            function update() { // button
                                safeWindowOpen(app.urls.update.replace('meta.js', 'user.js') + '?t=' + Date.now())
                            }, '', updateAlertWidth
                        )
 
                        // Localize button labels if needed
                        if (!config.userLanguage.startsWith('en')) {
                            const updateAlert = document.querySelector(`[id="${ updateModalID }"]`),
                                  updateBtns = updateAlert.querySelectorAll('button')
                            updateBtns[1].textContent = msgs.btnLabel_update || 'Update'
                            updateBtns[0].textContent = msgs.btnLabel_dismiss || 'Dismiss'
                        }
 
                        return
                }}
 
                // Alert to no update, return to About modal
                siteAlert(( msgs.alert_upToDate || 'Up-to-date' ) + '!', // title
                    `${ msgs.appName || app.name } (v${ currentVer }) ` // msg
                        + ( msgs.alert_isUpToDate || 'is up-to-date' ) + '!',
                    '', '', updateAlertWidth
                )
                launchAboutModal()
    }})}
 
    // Define FEEDBACK functions
 
    function notify(msg, position = '', notifDuration = '', shadow = '') {
 
        // Strip state word to append colored one later
        const foundState = menuState.word.find(word => msg.includes(word))
        if (foundState) msg = msg.replace(foundState, '')
 
        // Show notification
        chatgpt.notify(`${app.symbol} ${msg}`, position, notifDuration, shadow || chatgpt.isDarkMode() ? '' : 'shadow')
        const notif = document.querySelector('.chatgpt-notif:last-child')
 
        // Append styled state word
        if (foundState) {
            const styledState = document.createElement('span')
            styledState.style.cssText = `color: ${
                foundState == menuState.word[0] ? '#ef4848 ; text-shadow: rgba(255, 169, 225, 0.44) 2px 1px 5px'
                                                : '#5cef48 ; text-shadow: rgba(255, 250, 169, 0.38) 2px 1px 5px' }`
            styledState.append(foundState) ; notif.append(styledState)
        }
    }
 
    function siteAlert(title = '', msg = '', btns = '', checkbox = '', width = '') {
        return chatgpt.alert(title, msg, btns, checkbox, width )}
 
    // Define BUTTON functions
 
    function setBtnColor() {
        return chatgpt.isDarkMode() ? 'white' : '#202123'
    }
 
    function insertBtns() {
 
        // Find the composer's trailing area where send/voice buttons live
        const trailingArea = document.querySelector('[style*="grid-area:trailing"], [class*="trailing"]')
            || document.querySelector('form button[aria-label*="发送"], form button[data-testid="composer-speech-button"]')?.parentNode?.parentNode
        if (!trailingArea || trailingArea.contains(wideScreenBtn)) return
 
        // Insert buttons into trailing area, before existing buttons
        const firstTrailingChild = trailingArea.firstElementChild
        const elemsToInsert = [newChatBtn, wideScreenBtn, fullWindowBtn, fullScreenBtn, tooltipDiv]
        elemsToInsert.forEach(elem => {
            if (!trailingArea.contains(elem))
                trailingArea.insertBefore(elem, firstTrailingChild)
        })
    }
 
    function updateBtnSVG(mode, state = '') {
 
        // Define SVG viewbox + elems
        const svgViewBox = ( mode == 'newChat' ? '11 6 ' : mode == 'fullWindow' ? '-2 -0.5 ' : '8 8 ' ) // move to XY coords to crop whitespace
                         + ( mode == 'newChat' ? '13 13' : mode == 'fullWindow' ? '24 24' : '20 20' ) // shrink to fit size
        const fullScreenONelems = [
            createSVGelem('path', { fill: btnColor, d: 'm14,14-4,0 0,2 6,0 0,-6 -2,0 0,4 0,0 z' }),
            createSVGelem('path', { fill: btnColor, d: 'm22,14 0,-4 -2,0 0,6 6,0 0,-2 -4,0 0,0 z' }),
            createSVGelem('path', { fill: btnColor, d: 'm20,26 2,0 0,-4 4,0 0,-2 -6,0 0,6 0,0 z' }),
            createSVGelem('path', { fill: btnColor, d: 'm10,22 4,0 0,4 2,0 0,-6 -6,0 0,2 0,0 z' }) ]
        const fullScreenOFFelems = [
            createSVGelem('path', { fill: btnColor, d: 'm10,16 2,0 0,-4 4,0 0,-2 L 10,10 l 0,6 0,0 z' }),
            createSVGelem('path', { fill: btnColor, d: 'm20,10 0,2 4,0 0,4 2,0 L 26,10 l -6,0 0,0 z' }),
            createSVGelem('path', { fill: btnColor, d: 'm24,24 -4,0 0,2 L 26,26 l 0,-6 -2,0 0,4 0,0 z' }),
            createSVGelem('path', { fill: btnColor, d: 'M 12,20 10,20 10,26 l 6,0 0,-2 -4,0 0,-4 0,0 z' }) ]
        const fullWindowElems = [
            createSVGelem('rect', { x: '3', y: '3', width: '17', height: '17', rx: '2', ry: '2' }),
            createSVGelem('line', { x1: '9', y1: '3', x2: '9', y2: '21' }) ]
        const wideScreenONelems = [
            createSVGelem('path', { fill: btnColor, 'fill-rule': 'evenodd',
                d: 'm26,13 0,10 -16,0 0,-10 z m-14,2 12,0 0,6 -12,0 0,-6 z' }) ]
        const wideScreenOFFelems = [
            createSVGelem('path', { fill: btnColor, 'fill-rule': 'evenodd',
                d: 'm28,11 0,14 -20,0 0,-14 z m-18,2 16,0 0,10 -16,0 0,-10 z' }) ]
        const newChatElems = [ createSVGelem('path', { fill: btnColor, d: 'M22,13h-4v4h-2v-4h-4v-2h4V7h2v4h4V13z' }) ]
 
        // Pick appropriate button/elements
        const [button, ONelems, OFFelems] = (
            mode == 'fullScreen' ? [fullScreenBtn, fullScreenONelems, fullScreenOFFelems]
          : mode == 'fullWindow' ? [fullWindowBtn, fullWindowElems, fullWindowElems]
          : mode == 'wideScreen' ? [wideScreenBtn, wideScreenONelems, wideScreenOFFelems]
                                 : [newChatBtn, newChatElems, newChatElems])
 
        // Set SVG attributes
        const buttonSVG = button.querySelector('svg') || document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        buttonSVG.setAttribute('height', 18) // prevent shrinking
        if (mode == 'fullWindow') { // stylize full-window button
            buttonSVG.setAttribute('stroke', btnColor)
            buttonSVG.setAttribute('fill', 'none')
            buttonSVG.setAttribute('stroke-width', '2')
            buttonSVG.setAttribute('height', 17)
            buttonSVG.setAttribute('width', 17)
        }
        buttonSVG.setAttribute('viewBox', svgViewBox)
        buttonSVG.style.pointerEvents = 'none'
        buttonSVG.style.height = buttonSVG.style.width = '1.25rem'
 
        // Update SVG elements
        while (buttonSVG.firstChild) { buttonSVG.removeChild(buttonSVG.firstChild) }
        const svgElems = config[mode] || state.toLowerCase() == 'on' ? ONelems : OFFelems
        svgElems.forEach(elem => buttonSVG.append(elem))
 
        // Update SVG
        if (!button.contains(buttonSVG)) button.append(buttonSVG)
    }
 
    function createSVGelem(tagName, attributes) {
        const elem = document.createElementNS('http://www.w3.org/2000/svg', tagName)
        for (const attr in attributes) elem.setAttributeNS(null, attr, attributes[attr])
        return elem
    }
 
    // Define TOOLTIP functions
 
    function toggleTooltip(event) {
        updateTooltip(event.currentTarget.id.replace(/-button$/, ''))
        tooltipDiv.style.opacity = event.type == 'mouseover' ? '1' : '0'
    }
 
    function updateTooltip(buttonType) { // text & position
        tooltipDiv.innerText = msgs['tooltip_' + buttonType + (
            !/full|wide/i.test(buttonType) ? '' : (config[buttonType] ? 'OFF' : 'ON'))]
        const ctrAddend = 37, spreadFactor = 30.5,
              iniRoffset = spreadFactor * ( buttonType.includes('fullScreen') ? 1
                                          : buttonType.includes('fullWindow') ? 2
                                          : buttonType.includes('wide') ? 3 : 4 ) + ctrAddend
        tooltipDiv.style.right = `${
            iniRoffset - tooltipDiv.getBoundingClientRect().width /2 }px`
    }
 
    // Define TOGGLE functions
 
    function activateMode(mode) {
        if (mode == 'wideScreen') { document.head.append(wideScreenStyle) ; syncMode('wideScreen') }
        else if (mode == 'fullWindow') {
            document.head.append(fullWindowStyle)
            // Click close-sidebar button to sync React state
            document.querySelector('[data-testid="close-sidebar-button"]')?.click()
        } else if (mode == 'fullScreen') document.documentElement.requestFullscreen()
    }
 
    function deactivateMode(mode) {
        if (mode == 'wideScreen')
            try { document.head.removeChild(wideScreenStyle) ; syncMode('wideScreen') } catch (err) {}
        else if (mode == 'fullWindow') {
            try { document.head.removeChild(fullWindowStyle) } catch (err) {}
            // Click open-sidebar button to restore sidebar
            document.querySelector('[aria-label="打开边栏"]')?.click()
        } else if (mode == 'fullScreen') {
            if (config.f11)
                siteAlert(msgs.alert_pressF11 || 'Press F11 to exit full screen',
                    ( msgs.alert_f11reason || 'F11 was used to enter full screen, and due to browser security reasons,'
                        + 'the same key must be used to exit it' ) + '.')
            document.exitFullscreen().catch(err => console.error(app.symbol + ' » Failed to exit fullscreen', err))
        }
    }
 
    function toggleMode(mode, state = '') {
        switch (state.toUpperCase()) {
            case 'ON' : activateMode(mode) ; break
            case 'OFF' : deactivateMode(mode) ; break
            default : config[mode] ? deactivateMode(mode) : activateMode(mode)
        }
    }
 
    // Define SYNC functions
 
    function isFullWindow() {
        const sidebar = document.getElementById('stage-slideover-sidebar')
        return sidebar ? getComputedStyle(sidebar).display === 'none' : false
    }
 
    function syncMode(mode) { // setting + icon + tooltip
        const state = ( mode == 'wideScreen' ? !!document.getElementById('wideScreen-mode')
                      : mode == 'fullWindow' ? isFullWindow()
                                             : chatgpt.isFullScreen() )
        saveSetting(mode, state) ; updateBtnSVG(mode) ; updateTooltip(mode)
        if (mode == 'fullWindow') syncFullerWindows(state)
        if (!config.notifDisabled) // notify synced state
            notify(`${ msgs['mode_' + mode] } ${ state ? 'ON' : 'OFF' }`)
        config.modeSynced = true ; setTimeout(() => config.modeSynced = false, 100) // prevent repetition
    }
 
    function syncFullerWindows(fullWindowState) {
        if (fullWindowState && config.fullerWindows && !config.wideScreen) { // activate fuller windows
            document.head.append(wideScreenStyle) ; updateBtnSVG('wideScreen', 'on')
        } else if (!fullWindowState) { // de-activate fuller windows
            try { document.head.removeChild(fullWindowStyle) } catch (err) {} // to remove style too so sidebar shows
            if (!config.wideScreen) { // disable widescreen if result of fuller window
                try { document.head.removeChild(wideScreenStyle) } catch (err) {}
                updateBtnSVG('wideScreen', 'off')
    }}}
 
    let prevScreenProfile = '' // track screen changes for adaptive switching
 
    // Adaptive screen detection for multi-monitor setups
    function detectScreenProfile() {
        const w = window.screen.width, h = window.screen.height, ratio = w / h
        if (ratio >= 2.0) return 'ultrawide'   // 21:9 ultrawide (3440x1440, 2560x1080, etc.)
        if (ratio < 1.0) return 'portrait'     // vertical/portrait monitor
        return 'standard'                       // 16:9 or 16:10 normal landscape
    }
 
    const adaptiveStyle = document.createElement('style')
    adaptiveStyle.id = 'adaptive-width'
    document.head.append(adaptiveStyle)
 
    function applyAdaptiveWidth(profile) {
        let maxWidth
        switch (profile) {
            case 'ultrawide': maxWidth = '95%'; break
            case 'portrait':  maxWidth = '95%'; break
            default:          maxWidth = '85%'; break
        }
        adaptiveStyle.innerText =
            `[class*="thread-content-max-width"] { --thread-content-max-width: ${maxWidth} !important; max-width: ${maxWidth} !important }`
    }
 
    // Initial adaptive application
    if (config.autoAdaptive !== false) {
        prevScreenProfile = detectScreenProfile()
        applyAdaptiveWidth(prevScreenProfile)
    }
 
    function updateTweaksStyle() {
        tweaksStyle.innerText =
            ( '[id$="-button"]:hover { opacity: 80% !important }' )
          + ( config.hiddenHeader ? hhStyle : '' )
          + ( config.hiddenFooter ? hfStyle : '' )
          + ( !config.tcbDisabled ? tcbStyle : '' )
          + `#newChat-button { display: ${ config.ncbDisabled ? 'none' : 'flex' }}`
    }
 
    function updateWidescreenStyle() {
        // Override ChatGPT's CSS variable-based width limit (2026 UI)
        // --thread-content-max-width: 主内容区最大宽度
        // --thread-content-width: 表格的min-width引用变量（与上面是两个独立变量，必须同时覆盖）
        wideScreenStyle.innerText =
            '[class*="thread-content-max-width"] { --thread-content-max-width: 100% !important; --thread-content-width: 100% !important; max-width: 100% !important }'
          + '.text-base.mx-auto { max-width: 100% !important }'
          + '.max-w-\\[--thread-content-max-width\\] { max-width: 100% !important }'
          // 约束表格外层容器，防止w-fit撑破布局导致表格贴边
          + '[class*="tableContainer"] { max-width: 100% !important; overflow-x: auto !important }'
          + '[class*="tableWrapper"] { max-width: 100% !important }'
          // 解除表格的min-width强制约束，让窄表不无故撑满、宽表在容器内滚动
          + 'table[class*="min-w-"] { min-width: unset !important; max-width: 100% !important }'
        if (config.widerChatbox) wideScreenStyle.innerText += wcbStyle
    }
 
    function updateComposerMarginStyle() {
        // Reserve right space on composer ONLY, not the entire thread content
        composerMarginStyle.innerText = PLUGIN_RIGHT_MARGIN > 0
            ? `#thread-bottom-container { padding-right: ${PLUGIN_RIGHT_MARGIN}px !important }`
            : ''
    }
 
    // Run MAIN routine
 
    // Init MENU objs
    const menuIDs = [] // to store registered cmds for removal while preserving order
    const menuState = {
        symbol: ['❌', '✔️'], word: ['OFF', 'ON'],
        separator: getUserscriptManager() == 'Tampermonkey' ? ' — ' : ': '
    }
 
    // Define UI element SELECTORS (updated for 2026 ChatGPT UI)
    const inputSelector = '#prompt-textarea',
          sidebarSelector = '#stage-slideover-sidebar',
          sidepadSelector = 'main#main',
          headerSelector = 'header#page-header, header[data-fixed-header]'
    let footerSelector = '[class*="disclaimer"]'
 
    // Create browser TOOLBAR MENU or DISABLE SCRIPT if extension installed
    const extensionInstalled = await Promise.race([
        new Promise(resolve => {
            (function checkExtensionInstalled() {
                if (document.querySelector('[cwm-extension-installed]')) resolve(true)
                else setTimeout(checkExtensionInstalled, 200)
            })()
        }), new Promise(resolve => setTimeout(() => resolve(false), 1500))])
    if (extensionInstalled) { // disable script/menu
        GM_registerMenuCommand(menuState.symbol[0] + ' ' + ( msgs.menuLabel_disabled || 'Disabled (extension installed)' ),
            () => { return }) // disable menu
        return // exit script
    } else registerMenu() // create functional menu
 
    // AUTO-FOCUS ChatGPT chatbar if enabled
    if (/chatgpt|openai/.test(site) && !config.autoFocusChatbarDisabled) {
        await Promise.race([
            new Promise(resolve => {
                (function checkSecondChatbarBtn() { // since it causes de-focus
                    const chatbarBtns = document.querySelector(inputSelector)?.parentNode.parentNode.getElementsByTagName('button')
                    chatbarBtns?.length >= 2 ? resolve(true) : setTimeout(checkSecondChatbarBtn, 200)
                })();
            }), new Promise(resolve => setTimeout(resolve, 3000)) // timeout after 3s
        ])
        document.querySelector(inputSelector)?.focus()
    }
 
    // Save FULL-WINDOW + FULL SCREEN states
    config.fullWindow = isFullWindow()
    config.fullScreen = chatgpt.isFullScreen()
 
    // Stylize ALERTS
    if (!document.getElementById('chatgpt-alert-override-style')) {
        const chatgptAlertStyle = document.createElement('style')
        chatgptAlertStyle.id = 'chatgpt-alert-override-style'
        chatgptAlertStyle.innerText = (
            ( chatgpt.isDarkMode() ? '.chatgpt-modal > div { border: 1px solid white }' : '' )
          + '.chatgpt-modal button {'
              + 'font-size: 0.77rem ; text-transform: uppercase ;'
              + 'border-radius: 0 !important ; padding: 5px !important ; min-width: 102px }'
          + '.chatgpt-modal button:hover { transform: scale(1.055) }'
          + '.modal-buttons { margin-left: -13px !important }'
        )
        document.head.append(chatgptAlertStyle)
    }
 
    // Create/stylize TOOLTIP div
    const tooltipDiv = document.createElement('div')
    tooltipDiv.classList.add('toggle-tooltip')
    const tooltipStyle = document.createElement('style')
    tooltipStyle.innerText = '.toggle-tooltip {'
        + 'background-color: rgba(0, 0, 0, 0.71) ; padding: 5px ; border-radius: 6px ; border: 1px solid #d9d9e3 ;' // bubble style
        + 'font-size: 0.85rem ; color: white ;' // font style
        + 'position: absolute ; bottom: 50px ;' // v-position
        + 'box-shadow: 4px 6px 16px 0 rgb(0 0 0 / 38%) ;' // drop shadow
        + 'opacity: 0 ; transition: opacity 0.1s ; z-index: 9999 ;' // visibility
        + '-webkit-user-select: none ; -moz-user-select: none ; -ms-user-select: none ; user-select: none }' // disable select
    document.head.append(tooltipStyle)
 
    // Create/apply general style TWEAKS
    const tweaksStyle = document.createElement('style'),
          tcbStyle = inputSelector + '{ max-height: 68vh !important }', // heighten chatbox
          hhStyle = headerSelector + '{ display: none !important }' // hide header
                  + ( /chatgpt|openai/.test(site) ? 'main { padding-top: 12px }' : '' ), // increase top-padding
          hfStyle = footerSelector + '{ color: transparent !important ;' // hide footer text
                                   + '  padding: .1rem 0 0 !important }' // reduce v-padding
    updateTweaksStyle() ; document.head.append(tweaksStyle)
 
    // Create WIDESCREEN style
    const wideScreenStyle = document.createElement('style')
    wideScreenStyle.id = 'wideScreen-mode' // for syncMode()
    const wcbStyle = 'form.group\\/composer { max-width: 96% !important }' // Wider Chatbox
    updateWidescreenStyle()
 
    // Create COMPOSER right margin style (only affects the input area, not the whole thread)
    const composerMarginStyle = document.createElement('style')
    composerMarginStyle.id = 'composer-right-margin'
    updateComposerMarginStyle()
    document.head.append(composerMarginStyle)
 
    // Create FULL-WINDOW style
    const fullWindowStyle = document.createElement('style')
    fullWindowStyle.id = 'fullWindow-mode' // for syncMode()
    fullWindowStyle.innerText = (
          sidebarSelector + '{ display: none }' // hide sidebar
        + sidepadSelector + '{ padding-left: 0 }' ) // remove side padding
 
    // Create/insert chatbar BUTTONS
    const buttonTypes = ['fullScreen', 'fullWindow', 'wideScreen', 'newChat']
    let btnColor = setBtnColor()
    for (let i = 0 ; i < buttonTypes.length ; i++) {
        (buttonType => {
            const buttonName = buttonType + 'Btn'
            window[buttonName] = document.createElement('div')
            window[buttonName].id = buttonType + '-button'
            updateBtnSVG(buttonType)
            // Style as inline icon button matching ChatGPT's composer buttons
            window[buttonName].style.cssText =
                'display: inline-flex ; align-items: center ; justify-content: center ;'
              + 'height: 36px ; width: 36px ; min-width: 36px ;'
              + 'border-radius: 50% ; cursor: pointer ;'
              + 'position: relative ; flex-shrink: 0 ;'
              + 'transition: background-color 0.15s ;'
            window[buttonName].style.backgroundColor = 'transparent'
            // Hover effect
            window[buttonName].onmouseenter = () => {
                window[buttonName].style.backgroundColor = chatgpt.isDarkMode() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
            }
            window[buttonName].onmouseleave = () => {
                window[buttonName].style.backgroundColor = 'transparent'
            }
            // Click/hover listeners
            window[buttonName].onclick = () => {
                if (buttonType == 'newChat') chatgpt.startNewChat()
                else toggleMode(buttonType)
            }
            window[buttonName].onmouseover = toggleTooltip
            window[buttonName].onmouseout = toggleTooltip
 
        })(buttonTypes[i])
    } insertBtns()
 
    // Monitor NODE CHANGES to auto-toggle once + maintain button visibility + update colors
    let prevSessionChecked = false
    const nodeObserver = new MutationObserver(([mutation]) => {
 
        // Check loaded keys to restore previous session's state
        if (!prevSessionChecked) {
            if (config.wideScreen) toggleMode('wideScreen', 'ON')
            if (config.fullWindow) { toggleMode('fullWindow', 'ON')
                if (/chatgpt|openai/.test(site)) { // sidebar observer doesn't trigger
                    syncFullerWindows(true) // so sync Fuller Windows...
                    if (!config.notifDisabled) // ... + notify
                        notify(( msgs.mode_fullWindow || 'Full-window' ) + ' ON')
            }}
            if (config.tcbDisabled) updateTweaksStyle() ; prevSessionChecked = true
        }
 
        insertBtns() // re-insert buttons as they disappear during SPA navigation
 
        // Update button SVG colors on theme toggle
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            btnColor = setBtnColor()
            ;['fullScreen', 'fullWindow', 'wideScreen', 'newChat'].forEach(updateBtnSVG)
        }
    })
    nodeObserver.observe(document.documentElement, { attributes: true }) // <html> for page scheme toggles
    nodeObserver.observe(document.querySelector('main'), { attributes: true, subtree: true }); // <main> for chatbar changes
 
    // Monitor SIDEBAR to update full-window setting
    const sidebarObserver = new MutationObserver(() => {
        const fullWindowState = isFullWindow()
        if ((config.fullWindow && !fullWindowState) || (!config.fullWindow && fullWindowState))
            if (!config.modeSynced) syncMode('fullWindow')
    })
    setTimeout(() =>
        sidebarObserver.observe(document.body, {
            subtree: true, childList: false, attributes: true }), 500)
 
    // Add RESIZE/ADAPTIVE LISTENER
    window.onresize = () => {
        const fullScreenState = chatgpt.isFullScreen()
        if (config.fullScreen && !fullScreenState) { syncMode('fullScreen') ; config.f11 = false }
        else if (!config.fullScreen && fullScreenState) syncMode('fullScreen')
 
        // Adaptive: check if screen profile changed (window moved between monitors)
        if (config.autoAdaptive !== false) {
            const newProfile = detectScreenProfile()
            if (newProfile !== prevScreenProfile) {
                prevScreenProfile = newProfile
                applyAdaptiveWidth(newProfile)
                if (!config.notifDisabled)
                    notify(`Screen: ${newProfile === 'ultrawide' ? 'Ultrawide' : newProfile === 'portrait' ? 'Portrait' : 'Standard'}`)
            }
        }
    }
 
    // Add KEY LISTENER to enable flag on F11 + stop generating text on ESC
    window.onkeydown = event => {
        if ((event.key == 'F11' || event.keyCode == 122) && !config.fullScreen) config.f11 = true
        else if ((event.key == 'Escape' || event.keyCode == 27) && !chatgpt.isIdle()) chatgpt.stop()
    }
 
})()
