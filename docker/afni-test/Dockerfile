FROM afni/afni_make_build:latest

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    gfortran \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libicu-dev \
    pkg-config \
    xauth \
    xvfb \
  && rm -rf /var/lib/apt/lists/* \
  && Rscript -e 'options(repos=c(CRAN="https://packagemanager.posit.co/cran/__linux__/bionic/2018-10-01")); \
    install.packages(c("data.table","Rcpp","RcppEigen","lme4","lmerTest","phia","afex","car","emmeans","pbkrtest"), \
    dependencies=NA, lib="/usr/local/lib/R/site-library")' \
  && chown -R afni_user:users /usr/local/lib/R/site-library
USER afni_user
