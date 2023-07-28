require('dotenv').config();
import { NextFunction, Request, Response } from 'express';
import * as ChallengeController from '../services/challengeService';



export const beforeMain = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await ChallengeController.beforeMainData();
        return res.status(200).json({
            "code": 200,
            "message": "Ok",
            data
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            "code": 500,
            message: "Server Error"
        });
    }
};


export const challengeSearch = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categorySearch: string = req.query.categorySearch as string;
        const challenges = await ChallengeController.challengeSearchData(categorySearch);
        return res.status(200).json({
            "code": 200,
            "message": "Ok",
            data: {
                challenges
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            "code": 500,
            message: "Server Error"
        });
    }
};

export const afterMain = async (req: any, res: Response, next: NextFunction) => {
    try {

        const data = await ChallengeController.afterMainData(req.decoded.id);

        const nickname = data?.nickname;
        const coopen = data?.coopon;
        const userChallengeSu = data?.userChallengeSu;
        const userChallengeArray = data?.userChallengeArray
        const category = data?.category;
        const challengesArray = data?.challengesArray;
        const challengeCertain = data?.challengeCertain;

        return res.status(200).json({
            "code": 200,
            "message": "Ok",
            "data": {
                nickname,
                coopen,
                challengeCertain,
                userChallengeSu,
                userChallengeArray,
                category,
                challengesArray
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            "code": 500,
            "message": "Server Error"
        });
    }
};
