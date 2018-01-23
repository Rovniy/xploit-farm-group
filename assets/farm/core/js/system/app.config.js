(function () {
    'use strict';

    angular
        .module('farm', [
            'ngAnimate',
            'ngRoute',
            'ngSanitize',
            'ngCookies',
            'ui.bootstrap'
        ])
        .constant('config', {
            version: '0.0.1', //Текущая версия сайта
            template: 'stream', //Шаблон сайта
            theme: 'default', //Тема сайта
            mainUrl: window.location.protocol+ '//' + window.location.host,
            copy: 'xploit group. &copy ',
            social: {
                vkUrl: 'http://vk.com/xploitravy' //Ссылка на страницу вконтакте
            },
            debug: window.location.host === 'farm.local:9360' ? true : false
        })
        .config(config);

    config.$inject = ['$locationProvider'];

    function config ($locationProvider) {

        $locationProvider.html5Mode(true);
    }

})();