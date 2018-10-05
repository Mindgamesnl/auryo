import cn from 'classnames';
import React, { ReactNode } from 'react';

interface Props {
    image?: string;
    gradient?: string;
    title?: string;
    children?: Array<ReactNode> | null;
}

const PageHeader: React.SFC<Props> = ({ image, gradient, children, title }) => (
    <div className={cn('page-header ', {
        withImage: image
    })}
    >
        {image && <div className='bgImage'
            style={{ backgroundImage: `url(${image})` }} />}
        {gradient &&
            <div className='gradient' style={{ backgroundImage: gradient }} />}

        <div className='header-content'>
            {title ? (<h2>{title}</h2>) : children}
        </div>
    </div>
);

export default PageHeader;