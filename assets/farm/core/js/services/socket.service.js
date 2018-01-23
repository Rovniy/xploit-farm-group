(function () {
    'use strict';

    angular
        .module('farm')
        .service('socketService', socketService);

    socketService.$inject = ['$q', 'intercomService'];

    function socketService($q, intercomService) {
        var socket = atmosphere;
        var subSocket = null;
        var wsId = someNumber() + Date.now();
        var period_heart_bit = 1;
        var refreshIntervalId;
        var handlers = [];
        var isOpened = false;
        var transport = 'websocket';
        var poisonPill = atmosphere.util.parseJSON('{"close":"poison_pill"}');
        var deferredOpen = $q.defer();
        var deferredClose;
        
        // We are now ready to cut the request
        //https://github.com/Atmosphere/atmosphere/wiki/jQuery.atmosphere.js-atmosphere.js-API
        var request = {
            url: window.location.protocol + '//' + window.location.host + '/stream/web/socket',
            contentType: "application/json",
            logLevel: 'debug',
            //shared : true,
            trackMessageLength: true,
            reconnectInterval: 5000,
            connectTimeout: 10000,
            transport: transport,
            fallbackTransport: 'long-polling'
        };

        request.onOpen = function (response) {
            console.info('Socket: Сокет открылся. Тип соединения:', transport);
            isOpened = true;
            transport = response.transport;
            deferredOpen && deferredOpen.resolve();
        };

        request.onReopen = function (response) {
            isOpened = true;
            console.log('Socket: Повторное открытие сокета');
        };

        // For demonstration of how you can customize the fallbackTransport using the onTransportFailure function
        request.onTransportFailure = function (errorMsg, request, response) {
            if (errorMsg.indexOf("failed on first connection") > -1) {
                localStorage.wsOpen = false;
                socket.unsubscribe();
                return;
            }
            atmosphere.util.info(errorMsg);
            if (window.EventSource) {
                request.fallbackTransport = "sse";
            }
        };

        request.onMessage = function (response) {
            var message = response.responseBody;
            try {
                var json = angular.fromJson(message);
                console.log('Socket: Полученное с сервера:', json);
                intercomService.emit('incoming', json);
            }
            catch (e) {
                console.log('Socket: Ошибка обработки сообщения - ', message);
                return;
            }
            if (poisonPill.close && json.close && poisonPill.close == json.close) {
                localStorage.wsOpen = false;
                socket.unsubscribe();
            }
        };

        request.onClose = function (response) {
            console.log('Socket: Сокет закрылся');
            isOpened = false;
            deferredClose && deferredClose.resolve();
        };

        request.onError = function (response) {
            console.log('Socket: Ошибка подключение атмосферы');
            isOpened = false;
        };

        request.onReconnect = function (request, response) {
            console.log('Socket: Переподключение атмосферы');
        };

        $(window).on('beforeunload', function (evt) {
            if (socket && subSocket) {
                localStorage.wsOpen = false;
                socket.unsubscribe();
                clearInterval(refreshIntervalId);
                intercomService.emit('pass_socket');
            }
        });

        intercomService.on('incoming', function (data) {
            processHandlers(data);
        });

        //кто-то закинул сообщение в интерком
        //если websocket удерживаем мы, то передаем
        intercomService.on('outgoing', function (data) {
            // if (subSocket) {
                deferredOpen.promise.then(function () {
                    subSocket.push(window.atmosphere.util.stringifyJSON(data));
                    console.log('Socket: Переданное на сервер:', data);
                });
            // }
        });

        //кто-то закрыл сокет
        intercomService.on('pass_socket', function () {
            if (localStorage.wsId != wsId) {
                deferredOpen = $q.defer();
                setTimeout(
                    function () {
                        webSocketInit();
                    },
                    parseInt(getRandomArbitary(1, 1000), 10)
                );
            } else {
                // socket = undefined;
            }
        });

        return {
            webSocketInit: webSocketInit,
            sendMessage: sendMessage,
            removeHandler: removeHandler,
            addHandler: addHandler,
            close: close,
            isOpened: function () { return isOpened; },
            isWebSocketSupported: isWebSocketSupported
        };

        ////////////////

        //открытие сокета. если сокет уже кто-то открыл - курим бамбук, websocket остается NaN
        function webSocketInit() {
            // если случился креш и сокет остался открыт, проверка на ласт-апдейт;
            var forceOpen = false;
            var wsLU = localStorage.wsLU;
            if (wsLU){
                var diff = Date.now() - parseInt(wsLU);
                forceOpen = diff > period_heart_bit * 5 * 1000;
            }
            //double checked locking
            if (!localStorage.wsOpen || localStorage.wsOpen !== "true" || forceOpen) {
                //https://github.com/elad/LockableStorage/blob/master/LockableStorage.js#L139
                LockableStorage.trySyncLock("wsOpen", function () {
                    if (!localStorage.wsOpen || localStorage.wsOpen !== "true" || forceOpen) {
                        localStorage.wsOpen = true;
                        localStorage.wsId = wsId;
                        localStorage.wsLU = Date.now();
                        subSocket = socket.subscribe(request);
                        startHeartBitInterval();
                    }
                });
            }
        }

        //отослать сообщение через веб-сокет
        function sendMessage(data) {
            intercomService.emit('outgoing', data);
        }

        function removeHandler(f) {
            for (var i = 0; i < handlers.length; i++){
                if (handlers[i] === f){
                    handlers.splice(i, 1);
                    break;
                }
            }
        }

        //добавить хендлеры-обработчики сообщений
        function addHandler(f) {
            handlers.push(f);
        }

        /**
         * Закрытие сокета
         * @returns {angular.IPromise<void>}
         */
        function close() {
            if (socket && subSocket) {
                deferredClose = $q.defer();
                localStorage.wsOpen = false;
                socket.unsubscribe();
                return deferredClose.promise;
            }
            
            return $q.resolve();
        }

        ////вызоа всех методов. инициализируется веб-сокетом
        function processHandlers(message) {
            handlers.forEach(function (f) {
                f(message);
            });
        }

        function someNumber() {
            return Math.random() * 1000000000 | 0;
        }

        function getRandomArbitary(min, max) {
            return Math.random() * (max - min) + min;
        }

        /**
         * Запускаем цикл heartbit
         */
        function startHeartBitInterval() {
            refreshIntervalId = setInterval(function () {
                localStorage.wsLU = Date.now();
            }, period_heart_bit * 1000);
        }

        /**
         * Проверка на поддержку WS браузером
         * @return {boolean}
         */
        function isWebSocketSupported() {
            var supports = false;
            try {
                supports = 'WebSocket' in window && window.WebSocket.CLOSING === 2;
            } catch (e) {}
            return supports;
        }
    }

})();