var basePaths = {
    src: 'src/',
    dest: 'build/',
    stat: 'static/'
};
var paths = {
    templates: {
        src: basePaths.src,
        dest: basePaths.dest
    },
    images: {
        src: basePaths.src + basePaths.stat + 'img/',
        dest: basePaths.dest + basePaths.stat + 'img/'
    },
    scripts: {
        src: basePaths.src + basePaths.stat + 'js/',
        dest: basePaths.dest + basePaths.stat + 'js/'
    },
    styles: {
        src: basePaths.src + basePaths.stat + 'less/',
        dest: basePaths.dest + basePaths.stat + 'css/'
    },
    assets: {
        src: basePaths.src + basePaths.stat + 'assets/',
        dest: basePaths.dest + basePaths.stat + 'assets/'
    },
    bower: {
        src: basePaths.src + basePaths.stat + 'bower_components',
        dest: basePaths.dest + basePaths.stat + 'bower_components'
    }
};

var gulp = require('gulp'),
    $ = require('gulp-load-plugins')({
        pattern: '*',
        camelize: true
    }),
    browserSync = $.browserSync.create(),
    copyFiles = {
        scripts: []
    };

/* CSS - LESS */
function processCss(inputStream, taskType) {
    return inputStream
        .pipe($.plumber(function(error) {
            $.util.log($.util.colors.red('Error (' + error.plugin + '): ' + error.message));
            this.emit('end');
        }))
        .pipe($.newer(paths.styles.dest))
        .pipe($.less({ paths: [$.path.join(__dirname, 'less', 'includes')] }))
        .pipe($.rename({suffix: '.min'}))
        .pipe($.minifyCss({advanced: false}))
        .pipe(gulp.dest(paths.styles.dest))
        .pipe(browserSync.stream())
        //.pipe($.notify({ message: taskType + ' task complete' }));
}

gulp.task('styles', ['less:main', 'less:tablet', 'less:mobile']);
gulp.task('less:main', function() {
    return processCss(gulp.src(paths.styles.src + 'styles.less'), 'Styles');
});
gulp.task('less:tablet', function() {
    return processCss(gulp.src(paths.styles.src + 'styles-tablet.less'), 'Tablet styles');
});
gulp.task('less:mobile', function() {
    return processCss(gulp.src(paths.styles.src + 'styles-mobile.less'), 'Mobile styles');
});

/* JS */
gulp.task('scripts', ['scripts:moveFiles'], function() {
  return gulp.src(paths.scripts.src + '*.js')
    .pipe($.plumber(function(error) {
        $.util.log($.util.colors.red('Error (' + error.plugin + '): ' + error.message));
        this.emit('end');
    }))
    .pipe($.bytediff.start())
    .pipe($.newer(paths.scripts.dest))
    .pipe($.jshint('.jshintrc'))
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.concat('main.js'))
    .pipe($.rename({suffix: '.min'}))
    .pipe($.uglify())
    .pipe($.bytediff.stop())
    .pipe(gulp.dest(paths.scripts.dest))
    .pipe(browserSync.stream())
    //.pipe($.notify({ message: 'Scripts task complete' }));
});

/* Move JS files that are already minified to dist/js/ folder */
gulp.task('scripts:moveFiles', function() {
    gulp.src(copyFiles.scripts, { base: './static/js/' })
    .pipe(gulp.dest(paths.scripts.dest));
});

/* Images */
gulp.task('images', function() {
  return gulp.src(paths.images.src + '**/*')
    .pipe($.plumber(function(error) {
        $.util.log($.util.colors.red('Error (' + error.plugin + '): ' + error.message));
        this.emit('end');
    }))
    .pipe($.bytediff.start())
    .pipe($.newer(paths.images.dest))
    .pipe($.cache($.imagemin({ optimizationLevel: 3, progressive: true, interlaced: true })))
    .pipe($.bytediff.stop())
    .pipe(gulp.dest(paths.images.dest))
    .pipe(browserSync.stream())
    //.pipe($.notify({ message: 'Images task complete' }));
});

/* HTML */
gulp.task('copyHtml', function(){
    return gulp.src(paths.templates.src + "*.html")
        .pipe(gulp.dest(paths.templates.dest))
        .pipe(browserSync.stream())
        //.pipe($.notify({ message: 'HTML task complete' }));
});

gulp.task('copyBowerStuff',function(){
    gulp.src([paths.bower.src + '/**/*'])
    .pipe(gulp.dest(paths.bower.dest));
});

gulp.task('copyAssets',function(){
    gulp.src([paths.assets.src + '/**/*'])
    .pipe(gulp.dest(paths.assets.dest));
});

/* BrowserSync */
gulp.task('browser-sync', ['styles', 'scripts', 'images', 'copyHtml', 'copyAssets', 'copyBowerStuff'], function() {
    browserSync.init({
        server: {
            baseDir: "./build/"
        }
        //Use if you don't want BS to open a tab in your browser when it starts up
        //open: false
        // Will not attempt to determine your network status, assumes you're OFFLINE
        //online: false
    });
    gulp.watch(paths.styles.src + '**/*.less', ['styles']);
    gulp.watch(paths.scripts.src + '**/*.js', ['scripts']);
    gulp.watch(paths.images.src + '**/*', ['images']);
    gulp.watch(paths.templates.src + '*.html', ['copyHtml']).on('change', browserSync.reload);
});

gulp.task('clear', function (done) {
  return $.cache.clearAll(done);
});

/* Clean up stray files */
gulp.task('clean', ['clear'], function(cb) {
    $.del([basePaths.dest], cb)
});


/* Default task */
gulp.task('default', ['clean'], function() {
    gulp.start('browser-sync');
});
