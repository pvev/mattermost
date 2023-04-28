// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type SvgProps = {
    width: number;
    height: number;
};

const BoardsSvg = (props: SvgProps) => (
    <svg
        width={props.width ? props.width.toString() : '104'}
        height={props.height ? props.height.toString() : '104'}
        viewBox='0 0 104 104'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <path
            d='M30.8107 30.8445C36.3625 25.2589 43.3547 22.3795 51.7872 22.2063C60.1391 22.3835 67.0909 25.2629 72.6427 30.8445C78.1945 36.4261 81.0995 43.3849 81.3577 51.7211C81.0954 60.0492 78.1904 67.0081 72.6427 72.5977C67.0949 78.1874 60.1431 81.0728 51.7872 81.254C43.3506 81.0808 36.3585 78.2035 30.8107 72.6219C25.263 67.0403 22.358 60.0814 22.0957 51.7453C22.3499 43.393 25.2549 36.4261 30.8107 30.8445Z'
            fill='white'
        />
        <path
            d='M51.7873 83.8094C42.6648 83.5516 35.0694 80.4145 29.0012 74.398C22.933 68.3815 19.8122 60.8225 19.6387 51.7212C19.8122 42.6964 22.933 35.1577 29.0012 29.1049C35.0694 23.0522 42.6648 19.8969 51.7873 19.6392C60.8291 19.8929 68.3821 23.0501 74.4463 29.111C80.5104 35.1718 83.6314 42.7106 83.8089 51.7273C83.6354 60.8326 80.5145 68.3915 74.4463 74.404C68.378 80.4165 60.8251 83.5516 51.7873 83.8094ZM51.7873 25.6859C44.3836 25.9436 38.2307 28.5008 33.3285 33.3576C28.4263 38.2143 25.8865 44.3355 25.7089 51.7212C25.8784 59.107 28.4182 65.2483 33.3285 70.1453C38.2387 75.0423 44.3917 77.5774 51.7873 77.7506C59.1023 77.5774 65.2149 75.0423 70.1251 70.1453C75.0354 65.2483 77.5732 59.107 77.7386 51.7212C77.5692 44.3315 75.0314 38.2102 70.1251 33.3576C65.2189 28.5049 59.1063 25.9456 51.7873 25.6798V25.6859Z'
            fill='#FFBC1F'
        />
        <path
            d='M51.7866 71.0513C46.2792 70.8741 41.7179 69.0055 38.1028 65.4455C34.4877 61.8855 32.5934 57.3107 32.4199 51.7211C32.4199 46.3086 34.2073 41.7982 37.7821 38.1899C41.3568 34.5816 45.9827 32.6486 51.6595 32.3909C57.1669 32.4754 61.7503 34.344 65.4098 37.9966C69.0693 41.6492 70.9414 46.224 71.0262 51.7211C70.9414 57.2181 69.0693 61.7708 65.4098 65.3791C61.7841 68.9715 56.8952 71.007 51.7866 71.0513ZM52.0468 38.9631H51.7866C47.998 39.1323 44.8993 40.3988 42.4906 42.7627C41.2994 43.9314 40.3721 45.3406 39.7708 46.896C39.1696 48.4514 38.9084 50.1171 39.0046 51.7815C38.9927 53.4594 39.3181 55.1226 39.9616 56.6727C40.6051 58.2229 41.5535 59.6284 42.7508 60.8063C44.234 62.2942 46.0608 63.3954 48.0706 64.0131C50.0803 64.6307 52.2114 64.7459 54.2762 64.3484C56.341 63.9509 58.2763 63.0529 59.9117 61.7335C61.5472 60.4141 62.8326 58.7137 63.6549 56.7819C64.4773 54.8501 64.8113 52.7462 64.6277 50.6553C64.444 48.5644 63.7482 46.5507 62.6016 44.7912C61.455 43.0318 59.8927 41.5806 58.0522 40.5654C56.2117 39.5501 54.1495 39.002 52.0468 38.9692V38.9631Z'
            fill='#FFBC1F'
        />
        <path
            d='M47.9806 48.0304C48.992 47.0754 50.3315 46.5432 51.7238 46.5432C53.1161 46.5432 54.4555 47.0754 55.467 48.0304C56.4224 49.0152 56.9566 50.3323 56.9566 51.7031C56.9566 53.074 56.4224 54.3911 55.467 55.3759C54.4555 56.3309 53.1161 56.8631 51.7238 56.8631C50.3315 56.8631 48.992 56.3309 47.9806 55.3759C47.0293 54.3889 46.498 53.0726 46.498 51.7031C46.498 50.3337 47.0293 49.0174 47.9806 48.0304Z'
            fill='#FFBC1F'
        />
        <path
            d='M52.2649 52.4886C52.0775 52.6755 51.8232 52.7805 51.5581 52.7805C51.293 52.7805 51.0388 52.6755 50.8513 52.4886C50.6639 52.3016 50.5586 52.0481 50.5586 51.7838C50.5586 51.5195 50.6639 51.266 50.8513 51.0791L54.8334 47.1145L56.1146 48.524L52.2649 52.4886Z'
            fill='#818698'
        />
        <path
            d='M84.0617 28.9231C84.4908 31.3222 80.4265 33.1216 71.8689 34.3212L59.4235 48.2661C59.1507 48.5518 58.822 48.7785 58.4578 48.9322C58.0936 49.0859 57.7016 49.1634 57.3061 49.1598C56.4885 49.1609 55.7036 48.8397 55.1226 48.2661C54.8197 48.0037 54.5769 47.6793 54.4108 47.315C54.2448 46.9507 54.1593 46.5551 54.1602 46.1549C54.1695 45.324 54.489 44.5263 55.0564 43.9177L69.0478 31.6341C70.2508 23.1052 72.0554 19.0307 74.4614 19.4105C76.8675 19.7904 77.08 22.7893 75.099 28.4073C80.649 26.364 83.6366 26.536 84.0617 28.9231Z'
            fill='#1E325C'
        />
    </svg>
);

export default BoardsSvg;
