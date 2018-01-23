var gulp = require('gulp'),
// common
    lr = require('tiny-lr'),
    livereload = require('gulp-livereload'),
    lec = require('gulp-line-ending-corrector'),
    concat = require('gulp-concat'),
    server = lr(),
    expect = require('gulp-expect-file'),
// css
    less = require('gulp-less'),
    cleanCSS = require('gulp-clean-css'),
    autoprefixer = require('gulp-autoprefixer'),
// js
    uglify = require('gulp-uglify'),
    fileinclude = require('gulp-file-include'),
    bower = require('gulp-bower'),
    cssimport = require("gulp-cssimport"),
    angularFilesort = require('gulp-angular-filesort')
;

var express = require('express');
var vhost = require('vhost');
var proxyMiddleware = require('http-proxy-middleware');
var revHash = require('gulp-rev-hash');
var hash_src = require("gulp-hash-src");
var templateCache = require('gulp-angular-templatecache');
var htmlmin = require('gulp-htmlmin');
var https = require('https');
var fs = require('fs');

var jsPaths = [
    'bower_components/jquery/dist/jquery.min.js',
    'bower_components/bootstrap/dist/js/bootstrap.min.js',
    'bower_components/angular/angular.min.js',
    'bower_components/angular-animate/angular-animate.min.js',
    'bower_components/angular-cookies/angular-cookies.min.js',
    'bower_components/angular-sanitize/angular-sanitize.min.js',
    'bower_components/angular-bootstrap/ui-bootstrap.min.js',
    'bower_components/angular-bootstrap/ui-bootstrap-tpls.min.js',
    'bower_components/angular-route/angular-route.min.js',
    'bower_components/angular-file-upload/dist/angular-file-upload.min.js',
    'bower_components/angular-environment/dist/angular-environment.min.js',
    'bower_components/angular-translate/angular-translate.min.js',
    'bower_components/angular-translate-loader-static-files/angular-translate-loader-static-files.min.js',
    'bower_components/angular-translate-storage-local/angular-translate-storage-local.min.js',
    'bower_components/angular-translate-storage-cookie/angular-translate-storage-cookie.min.js',
    'bower_components/angular-translate-handler-log/angular-translate-handler-log.min.js',
    'bower_components/angular-bootstrap-colorpicker/js/bootstrap-colorpicker-module.min.js',
    'bower_components/angular-jquery/dist/angular-jquery.min.js',
    'bower_components/angular-bootstrap-affix/dist/angular-bootstrap-affix.min.js'
];

/**
 * Сборка всего JS
 */
var jsGen = function(name, target){
    target = target||name;
    return function(){
        return gulp.src(['./assets/'+name+'/**/*.js'])
            .pipe(angularFilesort())
            .pipe(concat('script.js'))
            .pipe(lec({eolc: 'LF', encoding:'utf8'}))
            .pipe(gulp.dest('./sites/'+name+'/js'))
            .pipe(livereload(server));
    };
};
gulp.task('js-stream', jsGen('farm'));
gulp.task('js-vendor', ['bower'], function(){
    return gulp.src(jsPaths)
        .pipe(expect(jsPaths))
        .pipe(concat('vendor.js'))
        .pipe(lec({ eolc: 'LF', encoding:'utf8'}))
        .pipe(gulp.dest('./sites/src/js'))
});


/**
 * Сборка всего CSS + LESS
 */
var lessGen = function(name){
    return function (){
        return gulp.src('./assets/'+name+'/core/styles/_common.less')
            .pipe(less())
            .pipe(autoprefixer())
            .pipe(cssimport())
            .pipe(lec({eolc: 'LF', encoding:'utf8'}))
            .pipe(concat('style.css'))
            .pipe(cleanCSS())
            .pipe(gulp.dest('./sites/'+name+'/css'))
            .pipe(livereload(server));
    };
};
gulp.task('less-stream', lessGen('farm'));

/**
 * Сборка всего HTML
 */
gulp.task('html-stream',['js-stream', 'templates'], function() {
    return gulp.src(['./assets/stream/index.html'])
        .pipe(fileinclude({
            prefix: '@@',
            basepath: '@file'
        }))
        .pipe(revHash({assetsDir: './sites'}))
        .pipe(hash_src({build_dir: "./sites/stream", src_path: "./assets/stream"}))
        .pipe(gulp.dest('./sites/stream'));
});

/**
 * Сборка всех шаблонов в JS файл
 */
gulp.task('templates-stream', [], function () {
    return gulp.src(['./assets/farm/modules/**/*.html'])
        .pipe(htmlmin({
            collapseWhitespace: true,
            conservativeCollapse: true
        }))
        .pipe(templateCache('templates.js', {
            module: 'farm',
            root: '/'
        }))
        .pipe(gulp.dest('./sites/farm/js'))
        .pipe(livereload(server));
});

/**
 * Запуск bower install перед сборкой, что бы у всех всегда совпадали версии либ.
 */
gulp.task('bower', ['bower-prune'], function() {
    return bower();
});

gulp.task('bower-prune', function() {
    return bower({ cmd: 'prune'});
});

gulp.task('stream', ['js-stream', 'less-stream', 'html-stream']);
gulp.task('templates', ['templates-stream']);
gulp.task('html', ['html-stream']);

gulp.task('build', ['stream']);

var taskWatch = function(){
    gulp.run('build');

    gulp.watch(['./assets/farm/**/*.html'], ['html-stream']);
    gulp.watch(['./assets/farm/**/*.less'],['less-stream']);
    gulp.watch(['./assets/farm/**/*.js'],['js-stream', 'html-stream']);
};

// Watch
gulp.task('watch', function() {
    server.listen(35729, function(err) {
        if (err) return console.log(err);
        taskWatch()
    });
    gulp.run('local-serverRu');
});

// Watch
gulp.task('watchProd', function() {
    server.listen(35729, function(err) {
        if (err) return console.log(err);
        taskWatch()
    });
    gulp.run('local-serverNet');
});

// configure proxy middleware options
var options = {
    target: 'http://farm.ru', // target host
    changeOrigin: true,               // needed for virtual hosted sites
    ws: true,                         // proxy websockets
    secure: false,                   //for https
    onProxyRes: function(proxyRes, req, res) {
        var cook = proxyRes.headers['set-cookie'];

        if(cook!=undefined ) {
            if (cook[0].indexOf('PLAY_SESSION')>-1) {
                proxyRes.headers['set-cookie'] = cook[0].replace('Domain=.farm.ru','Domain=.farm.local');
                console.log('cookie created successfully');
            }
        }
    }
};

var optionsProd = {
    target: 'http://streampub.net', // target host
    changeOrigin: true,               // needed for virtual hosted sites
    ws: true,                         // proxy websockets
    secure: false,                   //for https
    onProxyRes: function(proxyRes, req, res) {
        var cook = proxyRes.headers['set-cookie'];

        if(cook!=undefined ) {
            if (cook[0].indexOf('PLAY_SESSION')>-1) {
                proxyRes.headers['set-cookie'] = cook[0].replace('Domain=.streampub.net','Domain=.farm.local');
                console.log('cookie created successfully');
            }
        }
    }
};

var proxy = proxyMiddleware(['/api','/farm'], options);
var proxyProd = proxyMiddleware(['/api','/farm'], optionsProd);

var serverGen = function(proxy1, cb){

    var streamapp = express().use(express.static('./sites/farm')).get('/*', function(req, res, next){
        if ( req.path.indexOf('/src')>-1) return next();
        res.sendFile("index.html", {"root": __dirname + '/sites/farm'});
    });

    return function() {
        express()
            .use('/src', express.static('./sites/src'))
            .use(proxy1).on('upgrade', proxy1.upgrade)//
            .use(vhost('farm.local', streamapp))
            .listen(9360);

        cb()
    }
};


// Local server
gulp.task('local-serverRu', serverGen(proxy, function(){
        console.log('Server listening on http://onlinekiller.ru with remote back');
    })
);

// Prod server
gulp.task('local-serverNet', serverGen(proxyProd, function(){
        console.log('Server listening on http://streampub.net with remote back');
    })
);

// Default
gulp.task('default', function() {
    gulp.run('watch');
});