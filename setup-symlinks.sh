#!/bin/bash
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'



echo -e "\n${YELLOW}Creating symlinks for core module...${NC}"
mkdir src/core/src/types
mkdir src/core/src/utils
ln -sf ../../constants.ts src/core/src/constants.ts
ln -sf ../../../types/core src/core/src/types/core
ln -sf ../../../utils/core src/core/src/utils/core
ln -sf ../../../utils/shared src/core/src/utils/shared

echo -e "\n${YELLOW}Creating symlinks for http module...${NC}"
mkdir src/http/src/types
mkdir src/http/src/utils
ln -sf ../../constants.ts src/http/src/constants.ts
ln -sf ../../../types/core src/http/src/types/core
ln -sf ../../../types/http src/http/src/types/http
ln -sf ../../../utils/core src/http/src/utils/core
ln -sf ../../../utils/http src/http/src/utils/http
ln -sf ../../../utils/shared src/http/src/utils/shared
ln -sf ../../../utils/socket src/http/src/utils/socket

echo -e "\n${YELLOW}Creating symlinks for middlewares module...${NC}"
mkdir src/middlewares/src/types
mkdir src/middlewares/src/utils
ln -sf ../../constants.ts src/middlewares/src/constants.ts
ln -sf ../../../types/core src/middlewares/src/types/core
ln -sf ../../../utils/shared src/middlewares/src/utils/shared

echo -e "\n${YELLOW}Creating symlinks for aws module...${NC}"
mkdir src/aws/src/types
mkdir src/aws/src/utils
ln -sf ../../constants.ts src/aws/src/constants.ts
ln -sf ../../../types/core src/aws/src/types/core
ln -sf ../../../types/aws src/aws/src/types/aws
ln -sf ../../../utils/shared src/aws/src/core/shared
ln -sf ../../../utils/core src/aws/src/utils/core
ln -sf ../../../utils/aws src/aws/src/utils/aws



# Показываем результат
echo -e "\n${GREEN}Symlinks created:${NC}"


echo -e "\n${GREEN}Done!${NC}"