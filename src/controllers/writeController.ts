import { createRequire } from 'module'
const require = createRequire(import.meta.url)

require('dotenv').config();
import { NextFunction, Request, Response } from 'express';
import * as WriteService from '../services/writeService';
import { ChallengeCategoryDB, insertChallengeRequestDto, newChallengeRequestDto, newChallengeResponseDto, selectTemplateRequestDto, selectTemplateResponseDto, writeChallengeResponseDto } from '../interfaces/writeDTO';
import { ErrorResponse, SuccessResponse } from '../modules/returnResponse';

/**
 * 새 챌린지 시작 
 * @param req 챌린지 이름
 * @param res 
 * @returns 
 *            1. 서버오류(500)
 *            2. 이미 진행 중인 챌린지(415)
 *            3. 챌린지 수 초과(418)
 *            4. 데이터 반환 : 유저의 해당 챌린지 데이터와 시작한 챌린지 템플릿( 200)
 */
export const newChallenge = async (req: Request<newChallengeRequestDto>, res: Response<newChallengeResponseDto>) => {
    try {

        const newChallenge = req.params.name;
        const newChallengeData = await WriteService.userCooponChallengingCountData(req.decoded?.id);
        console.log(newChallengeData)
        const challengesCount = newChallengeData?.challengesCountDB._count.uchal_id;
        const chalIdData = await WriteService.selectChallengeData(newChallenge);

        if (chalIdData == undefined) {
            return
        }

        const challengePossible = await WriteService.userChallengeSelectData(req.decoded?.id, chalIdData[0].chal_id)

        if (challengePossible?.uchal_id === undefined) {

            if (!newChallengeData?.userCooponDB?.coopon) {
                if (2 <= challengesCount!) {
                    return new ErrorResponse(418, "더 이상 챌린지를 할 수 없습니다.").sendResponse(res);
                }
            }

            await WriteService.startChallengeData(req.decoded?.id, chalIdData[0].chal_id);

            const data = await WriteService.templateAndTodayChallengeData(req.decoded?.id, chalIdData[0].chal_id);
            const relativeChallengeArray = [];
            const challengTemplate = data?.challengTemplateDB.map((e) => {
                const transformedTemplates = e.templates.map((template) => ({
                    templateTitle: template.title,
                    templateContent: template.content,
                    category: e.category.name,
                    image: e.category.emogi
                }));

                return transformedTemplates;
            }).flat();
            

            for (var i = 0; i < data!.relativeChallengeDBFirst.length; i++) {
                if (!data?.relativeChallengeDBFirst[i].user_challenge_templetes[0]) {
                } else {
                    const relativeChallengeMap = data.relativeChallengeDBFirst.map((e) => {
                        return { challengeName: e.challenges.title, category: e.challenges.category.name };
                    });
                    relativeChallengeArray.push(relativeChallengeMap[i]);
                }
            }

            for (var i = 0; i < data!.relativeChallengeDBSecond.length; i++) {
                if (!data!.relativeChallengeDBSecond[i].user_challenge_templetes[0]) {
                    const relativeChallengeMap = data!.relativeChallengeDBSecond.map((e) => {
                        return { challengeName: e.challenges.title, category: e.challenges.category.name };
                    });
                    if (relativeChallengeArray.indexOf(relativeChallengeMap[i]) === -1) {
                        relativeChallengeArray.push(relativeChallengeMap[i]);
                    }
                }
            }

            const userChallenging = [
                ...relativeChallengeArray.filter(item => item.challengeName === newChallenge),
                ...relativeChallengeArray.filter(item => item.challengeName !== newChallenge)
            ];

            return new SuccessResponse(
                200,
                "OK",
                {
                    challengingArray: userChallenging,
                    templateData: {
                        challengeName: newChallenge,
                        challengeCategory: relativeChallengeArray[0]?.category,
                        templates: challengTemplate
                    }
                }
            ).sendResponse(res)
        }
        return new ErrorResponse(415, "현재 진행 중인 챌린지와 중복됩니다.").sendResponse(res);
    } catch (error) {
        console.error(error);
        return new ErrorResponse(500, "Server Error").sendResponse(res);
    }
};

/**
 * 챌린지 쓰기 (사이드 바) 함수
 * @param req 
 * @param res 
 * @returns 1. 서버오류
 *          2. 오늘 진행할 챌린지 없음
 *          3. 오늘 진행할 챌린지 데이터
 *        
 */
export const writeChallenge = async (req: Request, res: Response<writeChallengeResponseDto>) => {
    try {
        const writeChallenge = await WriteService.templateAndTodayChallengeData(req.decoded?.id);

        const challengingArray = [];
        const challengeChalIdyArray = [];
        let writeTemplate;
        let temporaryChallenge: { title: string | null; writing: string; }[] | undefined;
     
        const challengeArray = challengeRelativeMapping(writeChallenge.relativeChallengeDBFirst, writeChallenge.relativeChallengeDBSecond);

        if (challengeArray[0] == undefined) {
            return new ErrorResponse(404, "오늘은 더 이상 진행할 챌린지가 없습니다").sendResponse(res);
        }

        for (const e of challengeArray) {
            challengingArray.push({ "challengeName": e.challenges.title, "category": e.challenges.category.name });
            challengeChalIdyArray.push(e.chal_id);
        }

        if (challengeArray[0].user_challenge_templetes[0] == undefined) {                    // 값이 없다면
            writeTemplate = await WriteService.writeTemplateData(challengeChalIdyArray[0]);
            temporaryChallenge = [];
        }
        else {
            writeTemplate = await WriteService.writeTemplateData(challengeChalIdyArray[0], challengeArray[0].user_challenge_templetes[0].uctem_id);
            temporaryChallenge = writeTemplate!.temporaryChallengeDB?.map((e) => {
                return {
                    "title": e.title,
                    "writing": e.writing
                }
            })
        }
 
        const category = writeTemplate.categoryDB;
        let templateCertain: boolean;

        const templates = writeTemplate.challengeTemplateDB.map((e) => {
            return { "templateTitle": e.title, "templateContent": e.content, "category": e.challenges.category.name, "image": e.challenges.category.emogi }
        });

        if (temporaryChallenge![0] == undefined) {
            templateCertain = false;
        }
        else {
            templateCertain = true;
        }

        return new SuccessResponse(200, "OK", {
            templateCertain,
            temporaryChallenge,
            challengingArray,
            templateData: {
                challengeName: challengingArray[0].challengeName,
                challengeCategory: category[0].category.name,
                templates
            }
        }).sendResponse(res);

    } catch (error) {
        console.error(error);
        return new ErrorResponse(500, "Server Error").sendResponse(res);
    }
};

/**
 * 챌린지 쓰기 페이지 드롭다운 선택에 따른 챌린지 데이터 함수
 * @param req 챌린지 이름
 * @param res 
 * @returns 1. api 데이터 (200)
 *          2. 서버 오류
 */
export const selectTemplate = async (req: Request<selectTemplateRequestDto>, res: Response<selectTemplateResponseDto>) => {
    try {
        const challengeName = req.params.challengeName;
        const writeChallenge = await WriteService.templateAndTodayChallengeData(req.decoded?.id);

        const challengeArrayData = challengeRelativeMapping(writeChallenge.relativeChallengeDBFirst, writeChallenge.relativeChallengeDBSecond);

        const challengeIdCategoryData = await WriteService.selectChallengeData(challengeName);

        const templateAndChallengeIddData = await WriteService.selectTemplateData(challengeIdCategoryData[0].chal_id, req.decoded?.id);

        const challengingData = await WriteService.challengingData(templateAndChallengeIddData.challengeIdDB[0].uchal_id);

        let templateCertain: boolean;
        const userChallenging: { challengeName: string; category: string; }[] = [];


        challengeArrayData.forEach(e => {
            const challengeMap = { "challengeName": e.challenges.title, "category": e.challenges.category.name };
            if (!userChallenging.some(existingChallenge => existingChallenge.challengeName === challengeMap.challengeName)) {
                userChallenging.push(challengeMap);
            }
        });

        const challengingArray = [
            ...userChallenging.filter(item => item.challengeName === challengeName),
            ...userChallenging.filter(item => item.challengeName !== challengeName)
        ];

        for (var i = 0; i < templateAndChallengeIddData.templateDB.length; i++) {
            var category = challengeIdCategoryData.map((e) => {
                return { "category": e.category.name, "image": e.category.emogi };
            });
            templateAndChallengeIddData.templateDB[i].category = category[0].category;
            templateAndChallengeIddData.templateDB[i].image = category[0].image;
        }

        const templates = templateAndChallengeIddData.templateDB.map((e) => {
            return { "templateTitle": e.title, "templateContent": e.content, "category": e.category, "image": e.image };

        });

        const temporaryChallenge = challengingData.map((e) => {
            return {
                "title": e.title,
                "writing": e.writing,
                "userChallenge": e.user_challenges.challenges.title
            }
        });


        if (temporaryChallenge[0] == undefined) {
            templateCertain = false
        }
        else {
            templateCertain = true
        }

        const challengeCategory = challengeIdCategoryData[0].category.name;
        const templateData = { "challengeName": challengeName, "challengeCategory": challengeCategory, "templates": templates };

        return new SuccessResponse(200, "OK", {
            templateCertain,
            temporaryChallenge,
            challengingArray,
            templateData
        }).sendResponse(res);

    } catch (error) {
        console.error(error);
        return new ErrorResponse(500, "Server Error").sendResponse(res);
    }
};

/**
 * 챌린지 임시저장 함수
 * @param req 챌린지 이름, 템플릿 제목, 템플릿 내용
 * @param res 
 * @returns   1. 서버오류(500)
 *            2. 완료(200)
 */
export const insertTemporaryChallenge = async (req: Request<any, any, insertChallengeRequestDto>, res: Response) => {
    try {
        const { challengeName, challengeTitle, challengeContent } = req.body;

        const challengeId = await WriteService.selectChallengeData(challengeName);

        const userChallengeId = await WriteService.userChallengeSelectData(req.decoded?.id, challengeId[0].chal_id);

        const userChallengeTemplateId = await WriteService.selectTodayChallengeTemplateData(userChallengeId!.uchal_id);
        const complete = false;

        console.log(userChallengeTemplateId)

        if (userChallengeTemplateId === null) {
            await WriteService.insertChallengeTemplateData(
                complete,
                userChallengeId!.uchal_id,
                challengeTitle,
                challengeContent
            );
        } else {
            await WriteService.updateTimeChallengeTemplateData(
                complete,
                userChallengeId!.uchal_id,
                challengeTitle,
                challengeContent
            );
        }

        return new SuccessResponse(200, "OK").sendResponse(res);

    } catch (error) {
        console.error(error);
        return new ErrorResponse(500, "Server Error").sendResponse(res);
    }
};

/**
 * 챌린지 쓰기 함수
 * @param req  챌린지 이름, 템플릿 제목, 템플릿 내용
 * @param res 
 * @returns   1. 서버오류(500)
 *            2. 완료(200)
 */
export const insertChallengeComplete = async (req: Request<any, any, insertChallengeRequestDto>, res: Response) => {
    try {
        const { challengeName, challengeTitle, challengeContent } = req.body;

        const challengeId = await WriteService.selectChallengeData(challengeName);

        const userChallengeId = await WriteService.userChallengeSelectData(req.decoded?.id, challengeId[0].chal_id);

        const userChallengeTemplateId = await WriteService.selectTodayChallengeTemplateData(userChallengeId!.uchal_id);
        const complete = true;

        console.log(userChallengeTemplateId)

        if (userChallengeTemplateId === null) {
            await WriteService.insertChallengeTemplateData(
                complete,
                userChallengeId!.uchal_id,
                challengeTitle,
                challengeContent
            );
        } else {
            await WriteService.updateTimeChallengeTemplateData(
                complete,
                userChallengeId!.uchal_id,
                challengeTitle,
                challengeContent
            );
        }
        return new SuccessResponse(200, "OK").sendResponse(res);

    } catch (error) {
        console.error(error);
        return new ErrorResponse(500, "Server Error").sendResponse(res);
    }
};

/**
 *  글 플래너 페이지에서 템플릿 내용 수정 시 호출 함수
 * @param req  챌린지 이름, 템플릿 제목, 템플릿 내용
 * @param res 
 * @returns   1. 서버오류(500)
 *            2. 완료(200)
 */
export const plannerTemporaryChallenge = async (req: Request<any, any, insertChallengeRequestDto>, res: Response) => {
    try {
        const { challengeName, challengeTitle, challengeContent } = req.body;

        const challengeId = await WriteService.selectChallengeData(challengeName);

        const userChallengeId = await WriteService.userChallengeSelectData(req.decoded?.id, challengeId[0].chal_id);

        await WriteService.updateNoTimeChallengeTemplateData(
            userChallengeId!.uchal_id,
            challengeTitle,
            challengeContent
        );
    
        return new SuccessResponse(200, "OK").sendResponse(res);

} catch (error) {
    console.error(error);
    return new ErrorResponse(500, "Server Error").sendResponse(res);
}
};


/**
 * 유저가 오늘 써야할 챌린지 목록을 추출해주는 함수
 */
function challengeRelativeMapping(challengeCategoryDBFirst: ChallengeCategoryDB[], challengeCategoryDBSecond: ChallengeCategoryDB[]) {

    const challengeArray = [];

    for (var i = 0; i < challengeCategoryDBFirst.length; i++) {
        if (!challengeCategoryDBFirst[i].user_challenge_templetes[0]) {
        } else {
            challengeArray.push(challengeCategoryDBFirst[i]);
        }
    }
    for (var i = 0; i < challengeCategoryDBSecond.length; i++) {
        if (!challengeCategoryDBSecond[i].user_challenge_templetes[0]) {
            if (challengeArray.indexOf(challengeCategoryDBSecond[i]) === -1) {
                challengeArray.push(challengeCategoryDBSecond[i]);
            }
        }
    }

    return challengeArray;

}





