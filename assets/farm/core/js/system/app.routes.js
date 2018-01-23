(function () {
    'use strict';

    angular
        .module('farm')
        .config(config);

    config.$inject = ['$routeProvider'];

    /* @ngInject */
    function config ($routeProvider) {
        $routeProvider
            .when ('/', {
                templateUrl: '/index/index.html',
                controller: 'indexController',
                controllerAs: 'vm'
            })
            .otherwise({
                redirectTo: '/'
            });
    }

})();