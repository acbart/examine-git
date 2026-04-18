const iframeContent = /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Execution iFrame</title>
    <script>
        var __knownEngineId = undefined;
        var __debugMode = false;
        function debugLog(...message) {
            if (__debugMode) {
                console.log(...message);
            }
        }
        function debugError(where, error, engineId) {
            console.error(where, error);
            parent.postMessage({type: 'error', message: error.message, engineId}, '*');
        }
        function executeCodeInMain(code, engineId) {
            parent.postMessage({type: 'execution.begun', message: "Executing code", engineId}, '*');
            try {
                eval(code);
            } catch (e) {
                debugError("Iframe Main Error during Execution:", e, engineId);
            }
        }
        function forwardPostMessage(e, engineId) {
            try { e = JSON.parse(JSON.stringify(e.data)); } catch (err) {
                debugError("Iframe Web Worker Error during clone:", err, engineId);
            }
            try { e = {...e, engineId}; } catch (err) {
                debugError("Iframe Web Worker Error while attaching engineId:", err, engineId);
            }
            try { parent.postMessage(e, '*'); } catch (err) {
                debugError("Iframe Web Worker Error during postMessage:", err, engineId);
            }
        }
        function executeCodeInWorker(code, engineId) {
            parent.postMessage({type: 'execution.begun', message: "Executing code", engineId}, '*');
            const blob = new Blob([code], {type: 'application/javascript'});
            const worker = new Worker(URL.createObjectURL(blob));
            worker.addEventListener('message', (e) => {
                debugLog("Iframe Web Worker Heard:", e);
                forwardPostMessage(e, engineId);
            });
            worker.onerror = ((event) => {
                debugError("Iframe Web Worker Error during Execution:", event, engineId);
            });
        }

        let __latestWebWorker = null;
        addEventListener("message", (event) => {
            debugLog("Iframe heard:", event);
            const data = event.data;
            if (data.engineId != null) {
                __knownEngineId = data.engineId;
            }
            if (data.type === 'execute') {
                if (__latestWebWorker !== null) {
                    __latestWebWorker.terminate();
                }
                if (data.useWorker) {
                    executeCodeInWorker(data.code, data.engineId);
                } else {
                    executeCodeInMain(data.code, data.engineId);
                }
            } else if (data.type === 'terminate') {
                if (__latestWebWorker !== null) {
                    __latestWebWorker.terminate();
                }
            } else if (data.type === 'debug') {
                __debugMode = data.value != null ? data.value : !__debugMode;
            } else if (data.isForParent) {
                forwardPostMessage({
                    data: {
                        type: data.type,
                        contents: data.contents,
                        engineId: __knownEngineId,
                    }
                }, __knownEngineId);
            } else {
                debugError("Iframe General Error: Unknown message type:", data.type, data.engineId);
            }
        });
        addEventListener("error", (event) => {
            debugError("Iframe Uncaught Error:", event, __knownEngineId);
        });
    </script>
</head>
<body></body>
</html>`;

export function makeIFrame(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.style.width = '100%';
    iframe.style.overflow = 'auto';
    iframe.style.border = '1px black solid';
    iframe.srcdoc = iframeContent;
    document.body.appendChild(iframe);
    return iframe;
}

export function executeCodeInIFrame(
    iframe: HTMLIFrameElement,
    code: string,
    engineId: string,
    useWorker = false,
): void {
    iframe.contentWindow?.postMessage({ type: 'execute', code, engineId, useWorker }, '*');
}

export function terminateIFrame(iframe: HTMLIFrameElement, engineId: string): void {
    iframe.contentWindow?.postMessage({ type: 'terminate', engineId }, '*');
}

export function toggleIFrameDebug(
    iframe: HTMLIFrameElement,
    engineId: string,
    value?: boolean,
): void {
    iframe.contentWindow?.postMessage({ type: 'debug', value, engineId }, '*');
}

export function sendDataToIframe(
    iframe: HTMLIFrameElement,
    variableName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
): void {
    const target = iframe.contentWindow;
    if (target === null) {
        console.error('IFrame contentWindow is null');
        return;
    }
    // The iframe window is treated as a plain object to set dynamic properties
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    (target as any)[variableName] = data;
}
