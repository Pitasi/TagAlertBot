const project = require('./package');

const gulp = require('gulp')
const ts = require("gulp-typescript");
const tsProject = ts.createProject("tsconfig.json");
const del = require("del");

gulp.task('clean', function () {
    return del('dist');
});

gulp.task('copy-resources', ['clean'], function () {
    gulp.src([
        "Dockerfile",
        "migration.config.js",
        "migrations/*",
        "config.json"
    ], {base: './'})
        .pipe(gulp.dest("dist"));
    gulp.src([
        "src/resources/*"
    ], {base: './src/resources'})
        .pipe(gulp.dest("dist/resources"));
});

gulp.task('build', ['copy-resources'], function () {
    return tsProject.src()
        .pipe(tsProject())
        .js.pipe(gulp.dest("dist"));
});


gulp.task('default', function () {
    const help_text = `
    ==================================
        ${project.name} ${project.version}
    ==================================

    Gulp Tasks: 
        - gulp build: compile the sources into 'dist' folder
        - gulp clean: delete the 'dist' folder. Executed automatically before the "build" task
    `;

    console.log(help_text);
});
